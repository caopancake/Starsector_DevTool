import { pickDirectoryDialog } from '@/shared/runtime/dialog.runtime';
import { loadMod, scanGameOverview } from '@/shared/api/project-api';
import type { AppData, GameOverviewData } from '@/shared/types';

export async function pickDirectory(): Promise<string | null> {
  return pickDirectoryDialog('选择 Starsector 游戏目录或 Mod 目录');
}

export function loadProject(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
  return loadMod(modRoot, starsectorRoot);
}

export function scanWorkspaceOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return scanGameOverview(starsectorRoot);
}
