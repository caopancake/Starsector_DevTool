import { invoke } from '@tauri-apps/api/core';
import type { GameOverviewData, OpenDirectoryResult, ProjectManifest, ProjectSessionId } from '@/shared/types';

export function openProjectSession(modRoot: string, starsectorRoot: string | null): Promise<ProjectManifest> {
  return invoke('open_project_session', { payload: { modRoot, starsectorRoot } });
}

export function closeProjectSession(sessionId: ProjectSessionId): Promise<void> {
  return invoke('close_project_session', { payload: { sessionId } });
}

export function invalidateProjectSession(sessionId: ProjectSessionId, changedPaths: string[]): Promise<ProjectManifest> {
  return invoke('invalidate_project_session', { payload: { sessionId, changedPaths } });
}

export function invalidateCoreCache(starsectorRoot: string): Promise<void> {
  return invoke('invalidate_core_cache', { payload: { starsectorRoot } });
}

export function detectDirectory(path: string, knownStarsectorRoot: string | null): Promise<OpenDirectoryResult> {
  return invoke('detect_directory', { payload: { path, knownStarsectorRoot } });
}

export function scanGameOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return invoke('scan_game_overview', { payload: { starsectorRoot } });
}
