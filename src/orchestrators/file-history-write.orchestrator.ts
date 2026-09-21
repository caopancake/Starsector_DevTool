import type { useProjectStore } from '@/stores/project.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { refreshProjectSessionAfterWrite } from '@/orchestrators/project-session-refresh.orchestrator';
import { AppError } from '@/shared/lib/errors';
import type { WriteResult } from '@/shared/types';

type ProjectStore = ReturnType<typeof useProjectStore>;

export interface SavedWriteCompletion {
  label: string;
  modRoot: string;
  result: WriteResult;
  sessionId: string;
}

/** 写入完成登记 owner：成功 WriteResult 进入文件历史并触发 ProjectSession 刷新。 */
export async function completeSavedWrite(completion: SavedWriteCompletion, project: ProjectStore): Promise<void> {
  validateSavedWriteCompletion(completion);
  assertSavedWriteSessionCurrent(completion, project);
  const fileHistory = useFileHistoryStore();
  fileHistory.pushSavedWriteEntry(completion.modRoot, completion.result.changes, completion.label);
  await refreshProjectSessionAfterWrite(completion.modRoot, completion.result, completion.sessionId);
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
