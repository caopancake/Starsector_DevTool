import { invoke } from '@tauri-apps/api/core';
import type { AppData, GameOverviewData, OpenDirectoryResult } from '@/shared/types';

export function loadModData(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
  if (starsectorRoot) {
    return invoke('load_mod_data_with_root', { modRoot, starsectorRoot });
  }
  return invoke('load_mod_data', { modRoot });
}

export const loadMod = loadModData;

export function detectDirectory(path: string, fallbackStarsectorRoot?: string | null): Promise<OpenDirectoryResult> {
  return invoke('detect_directory', { path, fallbackStarsectorRoot: fallbackStarsectorRoot ?? null });
}

export function scanGameOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return invoke('scan_game_overview', { starsectorRoot });
}
