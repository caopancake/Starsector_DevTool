import { open } from '@tauri-apps/plugin-dialog';
import { loadMod, scanGameOverview } from '@/shared/api/project-api';
import type { AppData, GameOverviewData } from '@/shared/types';

export async function pickDirectory(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title: '选择 Starsector 游戏目录或 Mod 目录' });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}

export function loadProject(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
  return loadMod(modRoot, starsectorRoot);
}

export function scanWorkspaceOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return scanGameOverview(starsectorRoot);
}
