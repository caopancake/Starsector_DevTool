import { h } from 'vue';
import type { AppFeedback } from '@/shared/types';
import { replayFileChangeSet } from '@/services/write.service';
import { pathBelongsToRoot } from '@/shared/lib/paths';
import { invalidateProject } from '@/services/session.service';
import { invalidateQueryCacheByPaths } from '@/services/query-cache.service';
import { invalidateResourceCacheByPaths } from '@/services/resource-cache.service';
import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import { WINDOW_EVENTS } from '@/windows/window.events';
import { emitWindowEvent } from '@/windows/tauri.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';
import type { FileChangeRecord, FileChangeReplayDirection, WriteResult } from '@/shared/types';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
type FileHistoryStore = ReturnType<typeof useFileHistoryStore>;
export type FileHistoryReplayDirection = FileChangeReplayDirection;

interface FileHistoryReplayBehavior {
  actionText: string;
  commitEntry: (fileHistory: FileHistoryStore, entryId: string) => boolean;
  hasBinaryContent: (change: FileChangeRecord) => boolean;
  peekEntry: (fileHistory: FileHistoryStore) => FileSaveHistoryEntry | null;
  textForChange: (change: FileChangeRecord) => string | null;
}

const FILE_HISTORY_REPLAY_BEHAVIOR: Record<FileHistoryReplayDirection, FileHistoryReplayBehavior> = {
  undo: {
    actionText: '撤销',
    peekEntry: (fileHistory) => fileHistory.peekFileUndo(),
    commitEntry: (fileHistory, entryId) => fileHistory.commitFileUndo(entryId),
    textForChange: (change) => change.beforeText ?? null,
    hasBinaryContent: (change) => Boolean(change.beforeDataBase64),
  },
  redo: {
    actionText: '重做',
    peekEntry: (fileHistory) => fileHistory.peekFileRedo(),
    commitEntry: (fileHistory, entryId) => fileHistory.commitFileRedo(entryId),
    textForChange: (change) => change.afterText ?? null,
    hasBinaryContent: (change) => Boolean(change.afterDataBase64),
  },
};

export function replayNextFileUndo(project: ProjectStore, tables: TablesStore, feedback: AppFeedback) {
  return replayNextFileHistoryEntry('undo', project, tables, feedback);
}

export function replayNextFileRedo(project: ProjectStore, tables: TablesStore, feedback: AppFeedback) {
  return replayNextFileHistoryEntry('redo', project, tables, feedback);
}

function replayNextFileHistoryEntry(
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
  feedback: AppFeedback,
) {
  const fileHistory = useFileHistoryStore();
  const behavior = FILE_HISTORY_REPLAY_BEHAVIOR[direction];
  const entry = behavior.peekEntry(fileHistory);
  if (!entry) return false;
  confirmFileHistoryReplay(feedback, entry, behavior, async () => {
    try {
      await applyFileSaveHistoryEntry(entry, direction, project, tables);
      const committed = behavior.commitEntry(fileHistory, entry.id);
      if (!committed) {
        feedback.error(`${behavior.actionText}文件历史失败：历史栈状态已变化`);
        return;
      }
      feedback.success(`文件历史已${behavior.actionText}`);
    } catch (error) {
      feedback.error(error, `${behavior.actionText}文件历史失败`);
    }
  });
  return true;
}

function confirmFileHistoryReplay(
  feedback: AppFeedback,
  entry: FileSaveHistoryEntry,
  behavior: FileHistoryReplayBehavior,
  onConfirm: () => Promise<void>,
) {
  feedback.confirmWarning({
    title: `${behavior.actionText}文件历史`,
    content: () => renderConfirmContent(entry, behavior.actionText),
    actionText: behavior.actionText,
    onConfirm,
  });
}

function renderConfirmContent(entry: FileSaveHistoryEntry, action: string) {
  const paths = historyEntryPaths(entry);
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

async function applyFileSaveHistoryEntry(
  entry: FileSaveHistoryEntry,
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
) {
  const result = await replayFileChangeSet(direction, entry.changes);
  await notifyOpenWindows(entry.changes, direction);
  await invalidateLoadedSessions(project, result);
  refreshActiveTableIfAffected(project, tables, result.invalidatedPaths);
}

function historyEntryPaths(entry: FileSaveHistoryEntry): string[] {
  return entry.changes.map((change) => change.path);
}

async function notifyOpenWindows(changes: FileChangeRecord[], direction: FileHistoryReplayDirection) {
  const behavior = FILE_HISTORY_REPLAY_BEHAVIOR[direction];
  await Promise.all(
    changes.map(async (change) => {
      if (change.kind === 'directory') return;
      const text = behavior.textForChange(change);
      if (text === null && behavior.hasBinaryContent(change)) return;
      await emitWindowEvent(WINDOW_EVENTS.fileEditorTextApplied, { path: change.path, text: text ?? '' });
    }),
  );
}

async function invalidateLoadedSessions(project: ProjectStore, result: WriteResult) {
  const changedPaths = result.invalidatedPaths;
  await Promise.all(
    [...project.manifests.values()].map(async (manifest) => {
      const projectRoot = manifest.modRoot;
      const sessionPaths = changedPaths.filter((path) => pathBelongsToRoot(path, projectRoot));
      if (sessionPaths.length === 0) return;
      const updatedManifest = await invalidateProject(manifest.sessionId, sessionPaths);
      project.updateManifest(projectRoot, updatedManifest);
      invalidateQueryCacheByPaths(manifest, sessionPaths);
      invalidateResourceCacheByPaths(manifest.sessionId, projectRoot, sessionPaths);
    }),
  );
}

function refreshActiveTableIfAffected(project: ProjectStore, tables: TablesStore, changedPaths: string[]) {
  const active = project.activeManifest;
  if (!active) return;
  if (!changedPaths.some((path) => pathBelongsToRoot(path, active.modRoot))) return;
  tables.selectRowByKey(null);
}
