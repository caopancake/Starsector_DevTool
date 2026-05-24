import { loadWorkspace, saveWorkspace } from '@/shared/api/workspace-api';
import type { PersistedWorkspace } from '@/shared/types';

export function loadPersistedWorkspace(): Promise<PersistedWorkspace> {
  return loadWorkspace();
}

export function savePersistedWorkspace(state: PersistedWorkspace): Promise<void> {
  return saveWorkspace(state);
}
