import { invoke } from '@tauri-apps/api/core';
import type { DiscoveredField, ProjectSessionId, SpriteSubfolder, WriteResult } from '@/shared/types';

export function uploadSprite(
  sessionId: ProjectSessionId,
  modRoot: string,
  filename: string,
  data: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<WriteResult> {
  return invoke('upload_sprite', { payload: { sessionId, modRoot, filename, data, subfolder, overwrite } });
}

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return invoke('scan_core_fields', { payload: { starsectorRoot } });
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return invoke('scan_core_graphics', { payload: { starsectorRoot } });
}
