import { h, onMounted, onUnmounted, ref, type Ref } from 'vue';
import { NCheckbox } from 'naive-ui';
import type { AppFeedback } from '@/shared/types';
import { useSettingsStore } from '@/stores/settings.store';
import { openEditorWindow } from '@/windows/editor.window';
import { useProjectStore } from '@/stores/project.store';
import { pickDirectory, scanWorkspaceOverview } from '@/services/session.service';
import { captureActiveTableSaveTarget, saveCapturedTableChanges } from '@/orchestrators/table-save.orchestrator';
import { useTablesStore } from '@/stores/tables.store';
import type { AssociatedSpecCandidate } from '@/domain/tables/associated-spec-candidates';
import type { TableDetailAction } from '@/domain/tables/table-detail-actions';
import { listenWindowSaveEvents } from '@/orchestrators/window-save.orchestrator';
import { openFileEditorWindow, type FileEditorRequest } from '@/windows/file-editor.window';
import { openDirectoryTarget, openModFromOverview, type DirectoryOpeningOutcome } from '@/orchestrators/directory-opening.orchestrator';
import {
  captureWorkspaceCloseTarget,
  closeWorkspaceRuntime,
  removeLoadedModRuntime,
  type WorkspaceCloseTarget,
} from '@/orchestrators/workspace-lifecycle.orchestrator';
import {
  restorePersistedWorkspace,
  watchWorkspacePersistence,
  type WorkspacePersistenceWatcher,
} from '@/orchestrators/workspace-persistence.orchestrator';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';

export function useWorkspaceShellActions(feedback: AppFeedback) {
  const project = useProjectStore();
  const tables = useTablesStore();
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const { loadCoreFields } = useCoreSchema();
  let stopWindowSaveEvents: (() => void) | null = null;
  let workspacePersistence: WorkspacePersistenceWatcher | null = null;

  onMounted(async () => {
    recordLogBestEffort({ level: 'info', message: '程序启动', path: null, line: null });
    workspacePersistence = watchWorkspacePersistence();
    stopWindowSaveEvents = await listenWindowSaveEvents({
      onEditorSpecSaved: (event) => {
        feedback.success(`${event.id} 已保存`);
      },
    });
    const persistence = workspacePersistence;
    let shouldPersistRestoredWorkspace = false;
    try {
      persistence.beginRestore();
      await restorePersistedWorkspace({
        knownStarsectorRoot: settings.starsectorRoot,
        loadCoreFields,
        onModRestoreError: async (modRoot, displayName, error) => {
          await removeLoadedModRuntime(modRoot);
          feedback.error(error, `恢复 ${displayName} 失败`);
        },
        onModRestoreWarnings: (displayName, warnings) => {
          for (const warning of warnings) {
            feedback.warning(`${displayName}：${warning}`);
          }
        },
      });
      shouldPersistRestoredWorkspace = true;
    } catch (error) {
      feedback.error(error, '恢复工作区状态失败');
    } finally {
      try {
        await persistence.finishRestore(shouldPersistRestoredWorkspace);
      } catch (error) {
        feedback.error(error, '保存工作区状态失败');
      }
    }
  });

  onUnmounted(() => {
    recordLogBestEffort({ level: 'info', message: '程序关闭', path: null, line: null });
    stopWindowSaveEvents?.();
    stopWindowSaveEvents = null;
    workspacePersistence?.stop();
    workspacePersistence = null;
  });

  async function openDirectory() {
    try {
      const selected = await pickDirectory();
      if (!selected) return;
      recordLogBestEffort({ level: 'info', message: `打开目录：${selected}`, path: null, line: null });
      const outcome = await openDirectoryTarget(selected, settings.starsectorRoot);
      handleDirectoryOpeningOutcome(outcome);
    } catch (err) {
      feedback.error(err);
    }
  }

  async function loadOverviewMod(modRoot: string) {
    try {
      const outcome = await openModFromOverview(modRoot);
      handleDirectoryOpeningOutcome(outcome);
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
      recordLogBestEffort({ level: 'info', message: `刷新工作区：${overview.starsectorRoot}`, path: null, line: null });
      feedback.success(`工作区已刷新：${overview.mods.length} 个 Mod`);
    } catch (err) {
      feedback.error(err, '刷新工作区失败');
    }
  }

  function confirmCloseWorkspace() {
    const target = captureWorkspaceCloseTarget();
    const hasDirtyMods = target.modRoots.some((modRoot) => tables.hasModDirtyChanges(modRoot));
    feedback.confirmWarning({
      title: '关闭工作区',
      content: hasDirtyMods ? '当前工作区有未保存的 CSV 修改，关闭后这些修改将丢失。确认关闭？' : '确认关闭当前工作区？',
      actionText: '关闭',
      onConfirm: () => closeWorkspace(target),
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
      void removeMod(modRoot);
    }
  }

  async function saveChanges() {
    try {
      const target = captureActiveTableSaveTarget(project.activeManifest);
      if (!target) return;
      const candidates = target.associatedSpecCandidates;
      if (candidates.length > 0) {
        const selectedAssociatedSpecKeys = ref<Set<string>>(new Set(candidates.map((candidate) => candidate.key)));
        feedback.confirmWarning({
          title: '保存 CSV',
          content: () => renderAssociatedSpecDialog(candidates, selectedAssociatedSpecKeys),
          actionText: '保存',
          onConfirm: async () => {
            try {
              const selected = candidates
                .filter((candidate) => selectedAssociatedSpecKeys.value.has(candidate.key))
                .map(({ action, id, previousId, row }) => ({
                  action,
                  id,
                  previousId,
                  row,
                }));
              const result = await saveCapturedTableChanges(target, selected);
              showSaveResult(result);
            } catch (err) {
              feedback.error(err, '保存 CSV 失败');
            }
          },
        });
        return;
      }
      const result = await saveCapturedTableChanges(target, []);
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
    } else {
      openRequestedEditorWindow(action);
    }
  }

  function openRequestedFileEditor(request: FileEditorRequest) {
    void openFileEditorWindow({ ...request, settings: settings.settingsSnapshot() });
  }

  function handleDirectoryOpeningOutcome(outcome: DirectoryOpeningOutcome) {
    if (outcome.type === 'game-overview') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      feedback.success(`游戏目录已扫描：${outcome.availableModCount} 个 Mod`);
      recordLogBestEffort({ level: 'info', message: `游戏目录已扫描：${outcome.availableModCount} 个 Mod`, path: null, line: null });
    } else if (outcome.type === 'mod-loaded') {
      if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
      feedback.success(`Mod 已导入：${outcome.modName}`);
      recordLogBestEffort({ level: 'info', message: `Mod 已导入：${outcome.modName}`, path: null, line: null });
      for (const warning of outcome.warnings) {
        feedback.warning(warning);
      }
    } else if (outcome.type === 'already-loaded') {
      feedback.info('该 Mod 已在工作区中');
    } else {
      feedback.error(outcome.message ?? '未识别该目录');
    }
  }

  async function removeMod(modRoot: string, showMessage = true) {
    await removeLoadedModRuntime(modRoot);
    if (showMessage) feedback.success('Mod 已从工作区移除');
  }

  async function closeWorkspace(target: WorkspaceCloseTarget) {
    await closeWorkspaceRuntime(target);
    recordLogBestEffort({ level: 'info', message: '关闭工作区', path: null, line: null });
    feedback.success('工作区已关闭');
  }

  function showSaveResult(result: 'saved' | 'noop') {
    if (result === 'saved') feedback.success('当前 CSV 表已保存');
    else feedback.info('没有需要保存的修改');
  }

  function renderAssociatedSpecDialog(candidates: AssociatedSpecCandidate[], selectedKeys: Ref<Set<string>>) {
    return h('div', { class: 'associated-save-dialog' }, [
      h('p', '检测到 CSV 行变更可能需要同步关联 spec。只有勾选的动作会随本次 CSV 保存一起写入，并作为单次 history 记录。'),
      h(
        'div',
        { class: 'associated-save-list' },
        candidates.map((candidate) =>
          h(
            NCheckbox,
            {
              checked: selectedKeys.value.has(candidate.key),
              'onUpdate:checked': (checked: boolean) => {
                const next = new Set(selectedKeys.value);
                if (checked) next.add(candidate.key);
                else next.delete(candidate.key);
                selectedKeys.value = next;
              },
            },
            { default: () => candidate.label },
          ),
        ),
      ),
    ]);
  }

  function openRequestedEditorWindow(action: Extract<TableDetailAction, { type: 'editor-window' }>) {
    void openEditorWindow({
      kind: action.kind,
      modRoot: action.modRoot,
      id: action.id,
      sessionId: action.sessionId,
      settings: settings.settingsSnapshot(),
      starsectorRoot: action.starsectorRoot,
    });
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
