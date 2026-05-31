import { h } from 'vue';
import type { AppFeedback } from '@/shared/types';
import { replayFileChangeSet } from '@/services/write.service';
import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import { WINDOW_EVENTS } from '@/windows/window.events';
import { emitWindowEvent } from '@/windows/tauri.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';
import type { FileChangeRecord, FileChangeReplayDirection } from '@/shared/types';
import { invalidateLoadedProjectSessionsForWriteResult } from '@/orchestrators/project-session-invalidation.orchestrator';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
type FileHistoryStore = ReturnType<typeof useFileHistoryStore>;
export type FileHistoryReplayDirection = FileChangeReplayDirection;

interface FileHistoryReplayBehavior {
  actionText: string;
  commitEntry: (fileHistory: FileHistoryStore, modRoot: string, entryId: string) => boolean;
  hasBinaryContent: (change: FileChangeRecord) => boolean;
  peekEntry: (fileHistory: FileHistoryStore, modRoot: string) => FileSaveHistoryEntry | null;
  textForChange: (change: FileChangeRecord) => string | null;
}

const FILE_HISTORY_REPLAY_BEHAVIOR: Record<FileHistoryReplayDirection, FileHistoryReplayBehavior> = {
  undo: {
    actionText: '撤销',
    peekEntry: (fileHistory, modRoot) => fileHistory.peekFileUndo(modRoot),
    commitEntry: (fileHistory, modRoot, entryId) => fileHistory.commitFileUndo(modRoot, entryId),
    textForChange: (change) => change.beforeText ?? null,
    hasBinaryContent: (change) => Boolean(change.beforeDataBase64),
  },
  redo: {
    actionText: '重做',
    peekEntry: (fileHistory, modRoot) => fileHistory.peekFileRedo(modRoot),
    commitEntry: (fileHistory, modRoot, entryId) => fileHistory.commitFileRedo(modRoot, entryId),
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
  const modRoot = project.activeModRoot;
  if (!modRoot) return false;
  const sessionId = project.getSessionId(modRoot);
  if (!sessionId) return false;
  const behavior = FILE_HISTORY_REPLAY_BEHAVIOR[direction];
  const entry = behavior.peekEntry(fileHistory, modRoot);
  if (!entry) return false;
  confirmFileHistoryReplay(feedback, entry, behavior, async () => {
    try {
      const currentEntry = behavior.peekEntry(fileHistory, modRoot);
      if (currentEntry?.id !== entry.id) {
        feedback.error(`${behavior.actionText}文件历史失败：历史栈状态已变化`);
        return;
      }
      const currentSessionId = project.getSessionId(modRoot);
      if (currentSessionId !== sessionId) {
        feedback.error(`${behavior.actionText}文件历史失败：ProjectSession 已变化`);
        return;
      }
      await applyFileSaveHistoryEntry(sessionId, modRoot, entry, direction, project, tables);
      const committed = behavior.commitEntry(fileHistory, modRoot, entry.id);
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
  sessionId: string,
  modRoot: string,
  entry: FileSaveHistoryEntry,
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
) {
  const result = await replayFileChangeSet(sessionId, modRoot, direction, entry.changes);
  await notifyOpenWindows(modRoot, entry.changes, direction);
  const invalidatedSessions = await invalidateLoadedProjectSessionsForWriteResult(result, modRoot);
  refreshActiveTableIfAffected(project, tables, modRoot, invalidatedSessions);
}

function historyEntryPaths(entry: FileSaveHistoryEntry): string[] {
  return entry.changes.map((change) => change.path);
}

async function notifyOpenWindows(modRoot: string, changes: FileChangeRecord[], direction: FileHistoryReplayDirection) {
  const behavior = FILE_HISTORY_REPLAY_BEHAVIOR[direction];
  await Promise.all(
    changes.map(async (change) => {
      if (change.kind === 'directory') return;
      const text = behavior.textForChange(change);
      if (text === null && behavior.hasBinaryContent(change)) return;
      await emitWindowEvent(WINDOW_EVENTS.fileEditorTextApplied, { modRoot, path: change.path, text: text ?? '' });
    }),
  );
}

function refreshActiveTableIfAffected(
  project: ProjectStore,
  tables: TablesStore,
  targetModRoot: string,
  invalidatedSessions: Awaited<ReturnType<typeof invalidateLoadedProjectSessionsForWriteResult>>,
) {
  if (!invalidatedSessions.some((event) => event.manifest.modRoot === targetModRoot)) return;
  if (project.activeModRoot !== targetModRoot) return;
  tables.selectRowByKey(null);
}
