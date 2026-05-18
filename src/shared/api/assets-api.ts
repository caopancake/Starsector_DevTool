import { invoke } from '@tauri-apps/api/core';
import type { FileChangeRecord } from './files-api';

export interface UploadResult {
  ok: boolean;
  exists: boolean;
  path: string;
  overwritten: boolean;
  message?: string;
  changes: FileChangeRecord[];
}

export function uploadSprite(
  modRoot: string,
  filename: string,
  data: string,
  subfolder: 'ships' | 'weapons' | 'missiles' | 'fx',
  overwrite = false,
): Promise<UploadResult> {
  return invoke('upload_sprite', { payload: { modRoot, filename, data, subfolder, overwrite } });
}

export function loadImageDataUrl(modRoot: string, relPath: string, starsectorRoot?: string): Promise<string | null> {
  return invoke('load_image_data_url', { modRoot, relPath, starsectorRoot: starsectorRoot ?? null });
}

export interface DiscoveredField {
  key: string;
  type: string;
  origin: string;
}

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return invoke('scan_core_fields', { starsectorRoot });
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return invoke('scan_core_graphics', { starsectorRoot });
}
