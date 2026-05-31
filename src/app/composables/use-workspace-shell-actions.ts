import { h, onMounted, onUnmounted, ref, type Ref, watch } from 'vue';
import { NCheckbox } from 'naive-ui';
import type { AppFeedback } from '@/shared/types';
import { useSettingsStore } from '@/stores/settings.store';
import { useEditorsStore } from '@/stores/editors.store';
import { openEditorWindow } from '@/windows/editor.window';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { closeProject, invalidateCoreCacheForRoot, pickDirectory, scanWorkspaceOverview } from '@/services/session.service';
import { captureActiveTableSaveTarget, saveCapturedTableChanges } from '@/orchestrators/table-save.orchestrator';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';
import type { AssociatedFileCandidate } from '@/domain/tables/associated-file-candidates';
import type { TableDetailAction } from '@/domain/tables/table-detail-actions';
import { listenWindowSaveEvents } from '@/orchestrators/window-save.orchestrator';
import { openFileEditorWindow, type FileEditorRequest } from '@/windows/file-editor.window';
import { loadModFromOverview, openDetectedDirectory, type OpenDirectoryOutcome } from '@/orchestrators/open-directory.orchestrator';
import {
  restorePersistedWorkspace,
  watchWorkspacePersistence,
  type WorkspacePersistenceWatcher,
} from '@/orchestrators/workspace-persistence.orchestrator';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { recordLogBestEffort } from '@/services/app-config.service';
import { invalidateResourceCacheForSession } from '@/services/resource-cache.service';
import { invalidateQueryCacheForSession } from '@/services/query-cache.service';
import { editorSpecExtension } from '@/domain/editors/editor-kind-metadata';

interface WorkspaceCloseTarget {
  gameOverviewRoot: string | null;
  modRoots: string[];
  starsectorRoots: string[];
}

export function useWorkspaceShellActions(feedback: AppFeedback) {
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const { loadCoreFields } = useCoreSchema();
  let stopWindowSaveEvents: (() => void) | null = null;
  let workspacePersistence: WorkspacePersistenceWatcher | null = null;

  watch(
    () => workspace.activeModRoot,
    (modRoot) => {
      project.setActiveModRoot(modRoot);
      const manifest = modRoot ? project.getManifest(modRoot) : null;
      tables.activateFor(modRoot, manifest);
      editors.activateFor(modRoot);
      fileHistory.activateFor(modRoot);
    },
  );

  onMounted(async () => {
    recordLogBestEffort({ level: 'info', message: '程序启动', path: null, line: null });
    workspacePersistence = watchWorkspacePersistence();
    stopWindowSaveEvents = await listenWindowSaveEvents({
      onEditorSpecSaved: (event) => {
        feedback.success(`${event.id}.${editorSpecExtension(event.kind)} 已保存`);
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
          await removeMod(modRoot, false);
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
      const outcome = await openDetectedDirectory(selected, settings.starsectorRoot);
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
      const candidates = target.associatedFileCandidates;
      if (candidates.length > 0) {
        const selectedAssociatedFileKeys = ref<Set<string>>(new Set(candidates.map((candidate) => candidate.key)));
        feedback.confirmWarning({
          title: '保存 CSV',
          content: () => renderAssociatedFileDialog(candidates, selectedAssociatedFileKeys),
          actionText: '保存',
          onConfirm: async () => {
            try {
              const selected = candidates
                .filter((candidate) => selectedAssociatedFileKeys.value.has(candidate.key))
                .map(({ relPath, afterText, afterDataBase64, previousRelPath }) => ({
                  relPath,
                  afterText,
                  afterDataBase64,
                  previousRelPath,
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

  function handleOpenOutcome(outcome: OpenDirectoryOutcome) {
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
    const sessionId = project.getSessionId(modRoot);
    if (sessionId) {
      invalidateQueryCacheForSession(sessionId);
      invalidateResourceCacheForSession(sessionId);
    }
    workspace.removeMod(modRoot);
    tables.removeModState(modRoot);
    editors.removeModState(modRoot);
    fileHistory.removeModState(modRoot);
    csvEditHistory.clearForMod(modRoot);
    project.removeModData(modRoot);
    if (sessionId) await closeProject(sessionId);
    if (showMessage) feedback.success('Mod 已从工作区移除');
  }

  function captureWorkspaceCloseTarget(): WorkspaceCloseTarget {
    const starsectorRoots = new Set(
      [workspace.gameOverview?.starsectorRoot, ...[...project.manifests.values()].map((manifest) => manifest.starsectorRoot)].filter(
        (root): root is string => Boolean(root),
      ),
    );
    return {
      gameOverviewRoot: workspace.gameOverview?.starsectorRoot ?? null,
      modRoots: workspace.loadedModList.map((mod) => mod.modRoot),
      starsectorRoots: [...starsectorRoots],
    };
  }

  async function closeWorkspace(target: WorkspaceCloseTarget) {
    for (const modRoot of target.modRoots) {
      await removeMod(modRoot, false);
    }
    await Promise.all(target.starsectorRoots.map((root) => invalidateCoreCacheForRoot(root)));
    if (workspace.gameOverview?.starsectorRoot === target.gameOverviewRoot) {
      workspace.setGameOverview(null);
    }
    if (!workspace.activeModRoot) workspace.navigateTo('overview');
    recordLogBestEffort({ level: 'info', message: '关闭工作区', path: null, line: null });
    feedback.success('工作区已关闭');
  }

  function showSaveResult(result: 'saved' | 'noop') {
    if (result === 'saved') feedback.success('当前 CSV 表已保存');
    else feedback.info('没有需要保存的修改');
  }

  function renderAssociatedFileDialog(candidates: AssociatedFileCandidate[], selectedKeys: Ref<Set<string>>) {
    return h('div', { class: 'associated-save-dialog' }, [
      h('p', '检测到 CSV 行变更可能需要同步关联 spec 文件。只有勾选的文件会随本次 CSV 保存一起写入，并作为单次 history 记录。'),
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
            { default: () => `${candidate.action === 'create' ? '创建' : '删除'} ${candidate.relPath}` },
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
