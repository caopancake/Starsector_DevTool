import { invoke } from '@tauri-apps/api/core';
import type { PersistedWorkspace } from '@/shared/types';

export function loadWorkspace(): Promise<PersistedWorkspace> {
  return invoke('load_workspace');
}

export function saveWorkspace(state: PersistedWorkspace): Promise<void> {
  return invoke('save_workspace', { state });
}
