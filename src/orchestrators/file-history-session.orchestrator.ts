import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { replayFileChangeSet } from '@/services/write.service';
import { refreshLoadedSessionsAfterWrite, refreshProjectSessionAfterWrite } from '@/orchestrators/project-session-refresh.orchestrator';
import { WINDOW_EVENTS } from '@/windows/window.events';
import { emitWindowEvent } from '@/windows/tauri.events';
import type { FileChangeRecord, FileChangeReplayDirection, WriteResult } from '@/shared/types';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';
import { AppError } from '@/shared/lib/errors';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
export type FileHistoryReplayDirection = FileChangeReplayDirection;

export interface SavedWriteCompletion {
  label: string;
  modRoot: string;
  result: WriteResult;
  sessionId: string;
}

export interface FileHistoryReplayPlan {
  actionText: string;
  direction: FileHistoryReplayDirection;
  entry: FileSaveHistoryEntry;
  modRoot: string;
  sessionId: string;
}

interface FileHistoryReplayBehavior {
  actionText: string;
  commitEntry: (modRoot: string, entryId: string) => boolean;
  peekEntry: (modRoot: string) => FileSaveHistoryEntry | null;
  textForChange: (change: FileChangeRecord) => string | null;
  hasBinaryContent: (change: FileChangeRecord) => boolean;
}

export async function completeSavedWrite(completion: SavedWriteCompletion, project: ProjectStore): Promise<void> {
  validateSavedWriteCompletion(completion);
  assertSavedWriteSessionCurrent(completion, project);
  const fileHistory = useFileHistoryStore();
  fileHistory.pushSavedWriteEntry(completion.modRoot, completion.result.changes, completion.label);
  await refreshProjectSessionAfterWrite(completion.modRoot, completion.result, completion.sessionId);
}

export function createFileReplayPlan(project: ProjectStore, direction: FileHistoryReplayDirection): FileHistoryReplayPlan | null {
  const modRoot = project.activeModRoot;
  if (!modRoot) return null;
  const sessionId = project.getSessionId(modRoot);
  if (!sessionId) return null;
  const behavior = replayBehavior(direction);
  const entry = behavior.peekEntry(modRoot);
  if (!entry) return null;
  return { actionText: behavior.actionText, direction, entry, modRoot, sessionId };
}

export async function executeFileReplayPlan(plan: FileHistoryReplayPlan, project: ProjectStore, tables: TablesStore): Promise<void> {
  assertReplayPlanStillCurrent(plan, project);
  const result = await replayFileChangeSet(plan.sessionId, plan.modRoot, plan.direction, plan.entry.changes);
  const invalidatedSessions = await refreshLoadedSessionsAfterWrite(result, plan.modRoot);
  await notifyOpenFileEditors(plan.sessionId, plan.modRoot, plan.entry.changes, plan.direction);
  commitReplayPlan(plan);
  refreshActiveTableIfAffected(project, tables, plan.modRoot, invalidatedSessions);
}

function validateSavedWriteCompletion(completion: SavedWriteCompletion): void {
  if (!completion.modRoot) throw new AppError('无法记录文件历史：缺少 Mod 根目录', { action: 'complete-saved-write' });
  if (!completion.sessionId) throw new AppError('无法记录文件历史：缺少 ProjectSession', { action: 'complete-saved-write' });
  if (completion.result.changes.length === 0) {
    throw new AppError('无法记录文件历史：写入结果没有文件变更', { action: 'complete-saved-write' });
  }
}

function assertSavedWriteSessionCurrent(completion: SavedWriteCompletion, project: ProjectStore): void {
  const manifest = project.getManifest(completion.modRoot);
  if (!manifest || manifest.sessionId !== completion.sessionId) {
    throw new AppError('无法记录文件历史：ProjectSession 已变化', { action: 'complete-saved-write' });
  }
}

function assertReplayPlanStillCurrent(plan: FileHistoryReplayPlan, project: ProjectStore): void {
  const behavior = replayBehavior(plan.direction);
  const currentEntry = behavior.peekEntry(plan.modRoot);
  if (currentEntry?.id !== plan.entry.id) {
    throw new AppError(`${plan.actionText}文件历史失败：历史栈状态已变化`, { action: 'execute-file-history-replay' });
  }
  const currentSessionId = project.getSessionId(plan.modRoot);
  if (currentSessionId !== plan.sessionId) {
    throw new AppError(`${plan.actionText}文件历史失败：ProjectSession 已变化`, { action: 'execute-file-history-replay' });
  }
}

function commitReplayPlan(plan: FileHistoryReplayPlan): void {
  const committed = replayBehavior(plan.direction).commitEntry(plan.modRoot, plan.entry.id);
  if (!committed) {
    throw new AppError(`${plan.actionText}文件历史失败：历史栈状态已变化`, { action: 'commit-file-history-replay' });
  }
}

function replayBehavior(direction: FileHistoryReplayDirection): FileHistoryReplayBehavior {
  const fileHistory = useFileHistoryStore();
  if (direction === 'undo') {
    return {
      actionText: '撤销',
      peekEntry: (modRoot) => fileHistory.peekSavedWriteUndo(modRoot),
      commitEntry: (modRoot, entryId) => fileHistory.commitReplayUndo(modRoot, entryId),
      textForChange: (change) => change.beforeText ?? null,
      hasBinaryContent: (change) => Boolean(change.beforeDataBase64),
    };
  }
  return {
    actionText: '重做',
    peekEntry: (modRoot) => fileHistory.peekSavedWriteRedo(modRoot),
    commitEntry: (modRoot, entryId) => fileHistory.commitReplayRedo(modRoot, entryId),
    textForChange: (change) => change.afterText ?? null,
    hasBinaryContent: (change) => Boolean(change.afterDataBase64),
  };
}

async function notifyOpenFileEditors(
  sessionId: string,
  modRoot: string,
  changes: FileChangeRecord[],
  direction: FileHistoryReplayDirection,
): Promise<void> {
  const behavior = replayBehavior(direction);
  await Promise.all(
    changes.map(async (change) => {
      if (change.kind === 'directory') return;
      const text = behavior.textForChange(change);
      if (text === null && behavior.hasBinaryContent(change)) return;
      await emitWindowEvent(WINDOW_EVENTS.fileEditorTextApplied, { modRoot, path: change.path, sessionId, text: text ?? '' });
    }),
  );
}

function refreshActiveTableIfAffected(
  project: ProjectStore,
  tables: TablesStore,
  targetModRoot: string,
  invalidatedSessions: Awaited<ReturnType<typeof refreshLoadedSessionsAfterWrite>>,
) {
  if (!invalidatedSessions.some((event) => event.manifest.modRoot === targetModRoot)) return;
  if (project.activeModRoot !== targetModRoot) return;
  tables.selectRowByKey(null);
}
