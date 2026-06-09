import { invoke } from '@tauri-apps/api/core';
import type { DiscoveredField } from '@/shared/types';

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return invoke('scan_core_fields', { payload: { starsectorRoot } });
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return invoke('scan_core_graphics', { payload: { starsectorRoot } });
}
