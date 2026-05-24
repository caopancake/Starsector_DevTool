import { invoke } from '@tauri-apps/api/core';
import type { GameOverviewData, OpenDirectoryResult, ProjectManifest, ProjectSessionId } from '@/shared/types';

export function openProjectSession(modRoot: string, starsectorRoot?: string | null): Promise<ProjectManifest> {
  return invoke('open_project_session', { modRoot, starsectorRoot: starsectorRoot ?? null });
}

export function closeProjectSession(sessionId: ProjectSessionId): Promise<void> {
  return invoke('close_project_session', { sessionId });
}

export function invalidateProjectSession(sessionId: ProjectSessionId, changedPaths: string[]): Promise<void> {
  return invoke('invalidate_project_session', { payload: { sessionId, changedPaths } });
}

export function invalidateCoreCache(starsectorRoot: string): Promise<void> {
  return invoke('invalidate_core_cache', { payload: { starsectorRoot } });
}

export function detectDirectory(path: string, fallbackStarsectorRoot?: string | null): Promise<OpenDirectoryResult> {
  return invoke('detect_directory', { path, fallbackStarsectorRoot: fallbackStarsectorRoot ?? null });
}

export function scanGameOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return invoke('scan_game_overview', { starsectorRoot });
}
