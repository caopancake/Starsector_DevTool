import { h, onMounted, onUnmounted, ref, watch } from 'vue';
import { NCheckbox } from 'naive-ui';
import type { AppFeedback } from '@/shared/types';
import { useSettingsStore } from '@/stores/settings.store';
import { useEditorsStore } from '@/stores/editors.store';
import { openShipEditorWindow, openWeaponEditorWindow, openWeaponPreviewWindow, type EditorSpecSavedEvent } from '@/windows/editor.window';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { closeProject, invalidateProjectRootCache, pickDirectory, scanWorkspaceOverview } from '@/services/session.service';
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
import { recordLogSilently } from '@/services/app-config.service';
import { invalidateResourceCacheForSession } from '@/services/resource-cache.service';
import { invalidateQueryCacheForSession } from '@/services/query-cache.service';

export function useWorkspaceShellActions(feedback: AppFeedback) {
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
      const manifest = modRoot ? project.getManifest(modRoot) : null;
      tables.activateFor(modRoot ?? '', manifest);
      editors.activateFor(modRoot ?? '');
      fileHistory.activateFor(modRoot ?? '');
    },
  );

  onMounted(async () => {
    recordLogSilently({ level: 'info', message: '程序启动' });
    workspacePersistence = watchWorkspacePersistence();
    stopWindowSaveEvents = await listenWindowSaveEvents({
      onEditorSpecSaved: (payload) => {
        feedback.success(`${payload.id}.${editorExtension(payload.kind)} 已保存`);
      },
    });
    try {
      workspacePersistence.setRestoring(true);
      await restorePersistedWorkspace({
        fallbackStarsectorRoot: settings.starsectorRoot,
        loadCoreFields,
        onModRestoreError: (modRoot, displayName, error) => {
          removeMod(modRoot, false);
          feedback.error(error, `恢复 ${displayName} 失败`);
        },
        onModRestoreWarnings: (displayName, warnings) => {
          for (const warning of warnings) {
            feedback.warning(`${displayName}：${warning}`);
          }
        },
      });
    } catch {
      // Damaged workspace state is treated as a blank startup.
    } finally {
      workspacePersistence.setRestoring(false);
    }
  });

  onUnmounted(() => {
    recordLogSilently({ level: 'info', message: '程序关闭' });
    stopWindowSaveEvents?.();
    stopWindowSaveEvents = null;
    workspacePersistence?.stop();
    workspacePersistence = null;
  });

  async function openDirectory() {
    try {
      const selected = await pickDirectory();
      if (!selected) return;
      recordLogSilently({ level: 'info', message: `打开目录：${selected}` });
      const outcome = await openDetectedDirectory(selected, settings.starsectorRoot || null);
      handleOpenOutcome(outcome);
    } catch (err) {
      feedback.error(err);
    }
  }

  async function loadOverviewMod(modRoot: string) {
    try {
      const outcome = await loadModFromOverview(modRoot);
      handleOpenOutcome(outcome);
    } catch (err) {
      feedback.error(err);
    }
  }

  async function refreshWorkspace() {
    const root = workspace.gameOverview?.starsectorRoot;
    if (!root) return;
    try {
      const overview = await scanWorkspaceOverview(root);
      workspace.setGameOverview(overview);
      settings.setStarsectorRoot(overview.starsectorRoot);
      recordLogSilently({ level: 'info', message: `刷新工作区：${overview.starsectorRoot}` });
      feedback.success(`工作区已刷新：${overview.mods.length} 个 Mod`);
    } catch (err) {
      feedback.error(err, '刷新工作区失败');
    }
  }

  function confirmCloseWorkspace() {
    const hasDirtyMods = workspace.loadedModList.some((mod) => tables.hasModDirtyChanges(mod.modRoot));
    feedback.confirmWarning({
      title: '关闭工作区',
      content: hasDirtyMods ? '当前工作区有未保存的 CSV 修改，关闭后这些修改将丢失。确认关闭？' : '确认关闭当前工作区？',
      actionText: '关闭',
      onConfirm: closeWorkspace,
    });
  }

  function confirmRemoveMod(modRoot: string) {
    if (tables.hasModDirtyChanges(modRoot)) {
      feedback.confirmWarning({
        title: '移除 Mod',
        content: '该 Mod 有未保存修改，移除后修改将丢失。确认移除？',
        actionText: '移除',
        onConfirm: () => removeMod(modRoot),
      });
    } else {
      removeMod(modRoot);
    }
  }

  async function saveChanges() {
    try {
      if (!project.activeManifest) return;
      const candidates = selectActiveTableAssociatedFileCandidates();
      if (candidates.length > 0) {
        selectedAssociatedFileKeys.value = new Set(candidates.map((candidate) => candidate.key));
        feedback.confirmWarning({
          title: '保存 CSV',
          content: () => renderAssociatedFileDialog(candidates),
          actionText: '保存',
          onConfirm: async () => {
            try {
              const selected = candidates
                .filter((candidate) => selectedAssociatedFileKeys.value.has(candidate.key))
                .map(({ relPath, afterText }) => ({ relPath, afterText }));
              const result = await saveActiveTableChanges(project.activeManifest, selected);
              showSaveResult(result);
            } catch (err) {
              feedback.error(err, '保存 CSV 失败');
            }
          },
        });
        return;
      }
      const result = await saveActiveTableChanges(project.activeManifest);
      showSaveResult(result);
    } catch (err) {
      feedback.error(err, '保存 CSV 失败');
    }
  }

  function undoCurrentTableEdit() {
    if (!tables.undoCurrentTableEdit()) feedback.error('撤销 CSV 编辑失败');
  }

  function redoCurrentTableEdit() {
    if (!tables.redoCurrentTableEdit()) feedback.error('重做 CSV 编辑失败');
  }

  async function addNewRow() {
    if (!project.activeManifest) return;
    try {
      await tables.addNewRow();
    } catch (err) {
      feedback.error(err, '新建 CSV 行失败');
    }
  }

  async function deleteSelectedRow() {
    if (!project.activeManifest || !tables.selectedRowKey) return;
    try {
      await tables.deleteSelected();
    } catch (err) {
      feedback.error(err, '删除 CSV 行失败');
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
    void openFileEditorWindow({ ...request, settings: settings.settingsSnapshot() });
  }

  function handleOpenOutcome(outcome: {
    type: string;
    modName?: string;
    availableModCount?: number;
    message?: string;
    warnings?: string[];
  }) {
    if (outcome.type === 'game-overview') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      feedback.success(`游戏目录已扫描：${outcome.availableModCount ?? 0} 个 Mod`);
      recordLogSilently({ level: 'info', message: `游戏目录已扫描：${outcome.availableModCount ?? 0} 个 Mod` });
    } else if (outcome.type === 'mod-loaded') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      feedback.success(`Mod 已导入：${outcome.modName ?? 'Mod'}`);
      recordLogSilently({ level: 'info', message: `Mod 已导入：${outcome.modName ?? 'Mod'}` });
      for (const warning of outcome.warnings ?? []) {
        feedback.warning(warning);
      }
    } else if (outcome.type === 'already-loaded') {
      feedback.info('该 Mod 已在工作区中');
    } else {
      feedback.error(outcome.message ?? '未识别该目录');
    }
  }

  function removeMod(modRoot: string, showMessage = true) {
    const sessionId = project.getSessionId(modRoot);
    if (sessionId) {
      invalidateQueryCacheForSession(sessionId);
      invalidateResourceCacheForSession(sessionId);
      void closeProject(sessionId);
    }
    workspace.removeMod(modRoot);
    tables.removeModState(modRoot);
    editors.removeModState(modRoot);
    fileHistory.removeModState(modRoot);
    csvEditHistory.clearForMod(modRoot);
    project.removeModData(modRoot);
    if (showMessage) feedback.success('Mod 已从工作区移除');
  }

  function closeWorkspace() {
    const roots = new Set([...project.manifests.values()].map((manifest) => manifest.starsectorRoot).filter(Boolean));
    for (const mod of [...workspace.loadedModList]) {
      removeMod(mod.modRoot, false);
    }
    for (const root of roots) void invalidateProjectRootCache(root as string);
    workspace.setGameOverview(null);
    workspace.navigateTo('overview');
    project.setActiveModRoot(null);
    tables.activateFor('', null);
    editors.activateFor('');
    fileHistory.activateFor('');
    recordLogSilently({ level: 'info', message: '关闭工作区' });
    feedback.success('工作区已关闭');
  }

  function showSaveResult(result: 'saved' | 'noop') {
    if (result === 'saved') feedback.success('当前 CSV 表已保存');
    else feedback.info('没有需要保存的修改');
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
    void openShipEditorWindow(editorRequest(id));
  }

  function openWeapon(id: string) {
    if (!project.activeManifest) return;
    void openWeaponEditorWindow(editorRequest(id));
  }

  function openWeaponPreview(id: string) {
    if (!project.activeManifest) return;
    void openWeaponPreviewWindow(editorRequest(id));
  }

  function editorRequest(id: string) {
    const data = project.activeManifest!;
    return {
      modRoot: data.modRoot,
      id,
      sessionId: data.sessionId,
      settings: settings.settingsSnapshot(),
      starsectorRoot: data.starsectorRoot ?? workspace.gameOverview?.starsectorRoot ?? settings.starsectorRoot,
    };
  }

  function editorExtension(kind: EditorSpecSavedEvent['kind']) {
    if (kind === 'ship') return 'ship';
    if (kind === 'weapon') return 'wpn';
    return 'proj';
  }

  return {
    addNewRow,
    confirmCloseWorkspace,
    confirmRemoveMod,
    deleteSelectedRow,
    handleDetailAction,
    loadOverviewMod,
    openDirectory,
    redoCurrentTableEdit,
    refreshWorkspace,
    saveChanges,
    undoCurrentTableEdit,
  };
}
