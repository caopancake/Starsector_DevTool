import { h, onMounted, onUnmounted, ref, watch } from 'vue';
import { NButton, NCheckbox, NSpace, NText } from 'naive-ui';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { useSettingsStore } from '@/stores/settings.store';
import { cell } from '@/shared/lib/starsector';
import { extractFileReferenceFromError, formatError } from '@/shared/lib/errors';
import { useEditorsStore } from '@/stores/editors.store';
import { openShipEditorWindow, openWeaponEditorWindow, openWeaponPreviewWindow, type EditorSpecSavedEvent } from '@/windows/editor.window';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { pickDirectory } from '@/services/project.service';
import { selectActiveTableAssociatedFileCandidates, saveActiveTableChanges } from '@/orchestrators/table-save.orchestrator';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';
import type { AssociatedFileCandidate } from '@/domain/tables/associated-file-candidates';
import type { TableDetailAction } from '@/domain/tables/table-detail-actions';
import { listenWindowSaveEvents } from '@/orchestrators/window-save.orchestrator';
import { openFileEditorWindow, type FileEditorRequest } from '@/windows/file-editor.window';
import { loadModFromOverview, openDetectedDirectory } from '@/orchestrators/open-directory.orchestrator';
import {
  restorePersistedWorkspace,
  watchWorkspacePersistence,
  type WorkspacePersistenceWatcher,
} from '@/orchestrators/workspace-persistence.orchestrator';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useCoreSchema } from '@/app/composables/use-core-schema';

export function useWorkspaceShellActions(message: MessageApiInjection, dialog: DialogApiInjection) {
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const { loadCoreFields } = useCoreSchema();
  const selectedAssociatedFileKeys = ref<Set<string>>(new Set());
  let stopWindowSaveEvents: (() => void) | null = null;
  let workspacePersistence: WorkspacePersistenceWatcher | null = null;

  watch(
    () => workspace.activeModRoot,
    (modRoot) => {
      project.setActiveModRoot(modRoot);
      const appData = modRoot ? project.getModData(modRoot) : null;
      tables.activateFor(modRoot ?? '', appData);
      editors.activateFor(modRoot ?? '');
      fileHistory.activateFor(modRoot ?? '');
    },
  );

  onMounted(async () => {
    workspacePersistence = watchWorkspacePersistence();
    stopWindowSaveEvents = await listenWindowSaveEvents({
      onEditorSpecSaved: (payload) => {
        message.success(`${payload.id}.${editorExtension(payload.kind)} 已保存`);
      },
    });
    try {
      workspacePersistence.setRestoring(true);
      await restorePersistedWorkspace({
        fallbackStarsectorRoot: settings.starsectorRoot,
        loadCoreFields,
        onModRestoreError: (modRoot, displayName, error) => {
          removeMod(modRoot, false);
          showError(`恢复 ${displayName} 失败: ${formatError(error)}`, error);
        },
      });
    } catch {
      // Damaged workspace state is treated as a blank startup.
    } finally {
      workspacePersistence.setRestoring(false);
    }
  });

  onUnmounted(() => {
    stopWindowSaveEvents?.();
    stopWindowSaveEvents = null;
    workspacePersistence?.stop();
    workspacePersistence = null;
  });

  async function openDirectory() {
    try {
      const selected = await pickDirectory();
      if (!selected) return;
      const outcome = await openDetectedDirectory(selected, settings.starsectorRoot || null);
      handleOpenOutcome(outcome);
    } catch (err) {
      showError(formatError(err), err);
    }
  }

  async function loadOverviewMod(modRoot: string) {
    try {
      const outcome = await loadModFromOverview(modRoot);
      handleOpenOutcome(outcome);
    } catch (err) {
      showError(formatError(err), err);
    }
  }

  function confirmRemoveMod(modRoot: string) {
    if (tables.hasModDirtyChanges(modRoot)) {
      dialog.warning({
        title: '移除 Mod',
        content: '该 Mod 有未保存修改，移除后修改将丢失。确认移除？',
        positiveText: '移除',
        negativeText: '取消',
        onPositiveClick: () => removeMod(modRoot),
      });
    } else {
      removeMod(modRoot);
    }
  }

  async function saveChanges() {
    try {
      if (!project.activeModData) return;
      const candidates = selectActiveTableAssociatedFileCandidates(project.activeModData);
      if (candidates.length > 0) {
        selectedAssociatedFileKeys.value = new Set(candidates.map((candidate) => candidate.key));
        dialog.warning({
          title: '保存 CSV',
          content: () => renderAssociatedFileDialog(candidates),
          positiveText: '保存',
          negativeText: '取消',
          onPositiveClick: async () => {
            try {
              const selected = candidates
                .filter((candidate) => selectedAssociatedFileKeys.value.has(candidate.key))
                .map(({ relPath, afterText }) => ({ relPath, afterText }));
              const result = await saveActiveTableChanges(project.activeModData, selected);
              showSaveResult(result);
            } catch (err) {
              showError(formatError(err), err);
            }
          },
        });
        return;
      }
      const result = await saveActiveTableChanges(project.activeModData);
      showSaveResult(result);
    } catch (err) {
      showError(formatError(err), err);
    }
  }

  function revertChanges() {
    tables.revertChanges();
    message.success('已撤销未保存修改');
  }

  async function addNewRow() {
    if (!project.activeModData) return;
    try {
      await tables.addNewRow(project.activeModData);
      message.success('已新建行');
    } catch (err) {
      showError(formatError(err), err);
    }
  }

  async function deleteSelectedRow() {
    if (!project.activeModData || !tables.selectedRowKey) return;
    try {
      await tables.deleteSelected();
      message.success('已删除');
    } catch (err) {
      showError(formatError(err), err);
    }
  }

  function handleDetailAction(action: TableDetailAction) {
    if (action.type === 'file-editor') {
      openRequestedFileEditor(action);
    } else if (action.type === 'ship-editor') {
      openShip(action.id);
    } else if (action.type === 'weapon-editor') {
      openWeapon(action.id);
    } else {
      openWeaponPreview(action.id);
    }
  }

  function openRequestedFileEditor(request: FileEditorRequest) {
    void openFileEditorWindow(request);
  }

  function handleOpenOutcome(outcome: { type: string; modName?: string; availableModCount?: number; message?: string }) {
    if (outcome.type === 'game-overview') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      message.success(`已扫描游戏目录: ${outcome.availableModCount ?? 0} 个 Mod`);
    } else if (outcome.type === 'mod-loaded') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      message.success(`已导入: ${outcome.modName ?? 'Mod'}`);
    } else if (outcome.type === 'already-loaded') {
      message.info('该 Mod 已在工作区中');
    } else {
      message.error(outcome.message ?? '未识别该目录');
    }
  }

  function removeMod(modRoot: string, showMessage = true) {
    workspace.removeMod(modRoot);
    tables.removeModState(modRoot);
    editors.removeModState(modRoot);
    fileHistory.removeModState(modRoot);
    csvEditHistory.clearForMod(modRoot);
    project.removeModData(modRoot);
    if (showMessage) message.success('已从工作区移除');
  }

  function showSaveResult(result: 'saved' | 'noop') {
    message[result === 'saved' ? 'success' : 'info'](result === 'saved' ? '已保存 CSV 修改' : '没有需要保存的修改');
  }

  function renderAssociatedFileDialog(candidates: AssociatedFileCandidate[]) {
    return h('div', { class: 'associated-save-dialog' }, [
      h('p', '检测到 CSV 行变更可能需要同步关联 spec 文件。只有勾选的文件会随本次 CSV 保存一起写入，并作为单次 history 记录。'),
      h(
        'div',
        { class: 'associated-save-list' },
        candidates.map((candidate) =>
          h(
            NCheckbox,
            {
              checked: selectedAssociatedFileKeys.value.has(candidate.key),
              'onUpdate:checked': (checked: boolean) => {
                const next = new Set(selectedAssociatedFileKeys.value);
                if (checked) next.add(candidate.key);
                else next.delete(candidate.key);
                selectedAssociatedFileKeys.value = next;
              },
            },
            { default: () => `${candidate.action === 'create' ? '创建' : '删除'} ${candidate.relPath}` },
          ),
        ),
      ),
    ]);
  }

  function openShip(id: string) {
    if (!project.activeModData?.shipFiles[id]) {
      message.error(`找不到 ${id}.ship`);
      return;
    }
    void openShipEditorWindow(editorRequest(id));
  }

  function openWeapon(id: string) {
    if (!project.activeModData) return;
    if (!project.activeModData.wpnFiles[id] && !project.activeModData.weapons.some((weapon) => cell(weapon.id) === id)) {
      message.error(`找不到 ${id}.wpn`);
      return;
    }
    void openWeaponEditorWindow(editorRequest(id));
  }

  function openWeaponPreview(id: string) {
    if (!project.activeModData) return;
    void openWeaponPreviewWindow(editorRequest(id));
  }

  function editorRequest(id: string) {
    const data = project.activeModData!;
    return {
      modRoot: data.modRoot,
      id,
      starsectorRoot: data.starsectorRoot ?? workspace.gameOverview?.starsectorRoot ?? settings.starsectorRoot,
    };
  }

  function editorExtension(kind: EditorSpecSavedEvent['kind']) {
    if (kind === 'ship') return 'ship';
    if (kind === 'weapon') return 'wpn';
    return 'proj';
  }

  function showError(text: string, error: unknown = text) {
    const reference = extractFileReferenceFromError(error) ?? extractFileReferenceFromError(text);
    if (!reference) {
      message.error(text);
      return;
    }
    message.error(
      () =>
        h(
          NSpace,
          { align: 'center', wrap: false },
          {
            default: () => [
              h(NText, { type: 'error', style: { maxWidth: '680px', overflowWrap: 'anywhere' } }, { default: () => text }),
              h(
                NButton,
                {
                  size: 'tiny',
                  type: 'error',
                  secondary: true,
                  onClick: () =>
                    void openFileEditorWindow({
                      path: reference.path,
                      line: reference.line,
                      title: '文件编辑器',
                      contextLabel: '错误',
                      message: reference.message,
                    }),
                },
                { default: () => '打开错误文件' },
              ),
            ],
          },
        ),
      { duration: 10000, closable: true },
    );
  }

  return {
    addNewRow,
    confirmRemoveMod,
    deleteSelectedRow,
    handleDetailAction,
    loadOverviewMod,
    openDirectory,
    revertChanges,
    saveChanges,
  };
}
