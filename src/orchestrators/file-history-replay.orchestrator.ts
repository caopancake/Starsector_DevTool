import { h } from 'vue';
import type { AppFeedback } from '@/shared/types';
import { applyFileChangeSet, type FileChangeRecord } from '@/shared/api/files-api';
import { invalidateProjectSession } from '@/shared/api/project-api';
import { normalizeFsPath } from '@/shared/lib/paths';
import { invalidateResourceCacheByPaths } from '@/services/resource-cache.service';
import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import { WINDOW_EVENTS } from '@/windows/window.events';
import { emitWindowEvent } from '@/windows/tauri.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
export type FileHistoryReplayDirection = 'undo' | 'redo';

export function replayNextFileHistoryEntry(
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
  feedback: AppFeedback,
) {
  const fileHistory = useFileHistoryStore();
  const entry = direction === 'undo' ? fileHistory.peekFileUndo() : fileHistory.peekFileRedo();
  if (!entry) return false;
  confirmFileHistoryReplay(feedback, entry, direction, async () => {
    try {
      await applyFileSaveHistoryEntry(entry, direction, project, tables);
      const committed = direction === 'undo' ? fileHistory.commitFileUndo(entry.id) : fileHistory.commitFileRedo(entry.id);
      if (!committed) {
        feedback.error(`${fileHistoryAction(direction)}文件历史失败：历史栈状态已变化`);
        return;
      }
      feedback.success(`文件历史已${fileHistoryAction(direction)}`);
    } catch (error) {
      feedback.error(error, `${fileHistoryAction(direction)}文件历史失败`);
    }
  });
  return true;
}

function confirmFileHistoryReplay(
  feedback: AppFeedback,
  entry: FileSaveHistoryEntry,
  direction: FileHistoryReplayDirection,
  onConfirm: () => Promise<void>,
) {
  const action = fileHistoryAction(direction);
  feedback.confirmWarning({
    title: `${action}文件历史`,
    content: () => renderConfirmContent(entry, action),
    actionText: action,
    onConfirm,
  });
}

function renderConfirmContent(entry: FileSaveHistoryEntry, action: string) {
  const paths = entry.changes.map((change) => change.path);
  return h('div', { class: 'file-history-confirm' }, [
    h('p', `${action}会直接写回磁盘。`),
    h('p', `历史记录：${entry.label}`),
    h('p', `涉及文件：${paths.length} 个`),
    h(
      'ul',
      { class: 'file-history-confirm-list' },
      paths.map((path) => h('li', { key: path }, path)),
    ),
  ]);
}

function fileHistoryAction(direction: FileHistoryReplayDirection) {
  return direction === 'undo' ? '撤销' : '重做';
}

async function applyFileSaveHistoryEntry(
  entry: FileSaveHistoryEntry,
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
) {
  await applyFileChangeSet(direction, entry.changes);
  await notifyOpenWindows(entry.changes, direction);
  await invalidateLoadedSessions(project, entry.changes);
  refreshActiveTableIfAffected(project, tables, entry.changes);
}

async function notifyOpenWindows(changes: FileChangeRecord[], direction: FileHistoryReplayDirection) {
  await Promise.all(
    changes.map(async (change) => {
      if (change.kind === 'directory') return;
      const text = textForFileHistoryDirection(change, direction);
      if (text === null && hasBinaryFileContent(change, direction)) return;
      await emitWindowEvent(WINDOW_EVENTS.fileEditorTextApplied, { path: change.path, text: text ?? '' });
    }),
  );
}

async function invalidateLoadedSessions(project: ProjectStore, changes: FileChangeRecord[]) {
  const changedPaths = changes.map((change) => change.path);
  await Promise.all(
    [...project.manifests.values()].map(async (manifest) => {
      const sessionPaths = changedPaths.filter((path) => pathBelongsToRoot(path, manifest.modRoot));
      if (sessionPaths.length === 0) return;
      await invalidateProjectSession(manifest.sessionId, sessionPaths);
      invalidateResourceCacheByPaths(manifest.sessionId, sessionPaths);
    }),
  );
}

function refreshActiveTableIfAffected(project: ProjectStore, tables: TablesStore, changes: FileChangeRecord[]) {
  const active = project.activeManifest;
  if (!active) return;
  if (!changes.some((change) => pathBelongsToRoot(change.path, active.modRoot))) return;
  tables.selectRowByKey('');
}

function pathBelongsToRoot(path: string, root: string) {
  const normalizedPath = normalizeFsPath(path);
  const normalizedRoot = normalizeFsPath(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function textForFileHistoryDirection(change: FileChangeRecord, direction: FileHistoryReplayDirection): string | null {
  return direction === 'undo' ? (change.beforeText ?? null) : (change.afterText ?? null);
}

function hasBinaryFileContent(change: FileChangeRecord, direction: FileHistoryReplayDirection): boolean {
  return Boolean(direction === 'undo' ? change.beforeDataBase64 : change.afterDataBase64);
}
