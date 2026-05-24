import { pickDirectoryDialog } from '@/shared/runtime/dialog.runtime';
import { closeProjectSession, invalidateCoreCache, openProjectSession, scanGameOverview } from '@/shared/api/project-api';
import type { GameOverviewData, ProjectManifest } from '@/shared/types';
import { recordPerformance } from '@/services/performance.service';

export async function pickDirectory(): Promise<string | null> {
  return pickDirectoryDialog('选择 Starsector 游戏目录或 Mod 目录');
}

export async function openProject(modRoot: string, starsectorRoot?: string | null): Promise<ProjectManifest> {
  const fields = { modRoot, hasStarsectorRoot: Boolean(starsectorRoot) };
  const startedAt = performance.now();
  const invokeStartedAt = performance.now();
  const manifest = await openProjectSession(modRoot, starsectorRoot);
  recordPerformance('frontend.openProjectSession.invoke', performance.now() - invokeStartedAt, fields);
  recordPerformance('frontend.openProjectSession', performance.now() - startedAt, fields);
  return manifest;
}

export function scanWorkspaceOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return scanGameOverview(starsectorRoot);
}

export function closeProject(sessionId: string): Promise<void> {
  return closeProjectSession(sessionId);
}

export function invalidateProjectRootCache(starsectorRoot: string): Promise<void> {
  return invalidateCoreCache(starsectorRoot);
}
