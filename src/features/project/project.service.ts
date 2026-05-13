import { open } from '@tauri-apps/plugin-dialog';
import { loadModData } from '../../shared/api/tauri';
import type { AppData } from '../../shared/types';

export async function pickModRoot(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title: '选择 Starsector Mod 根目录' });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}

export function loadProject(modRoot: string): Promise<AppData> {
  return loadModData(modRoot);
}
