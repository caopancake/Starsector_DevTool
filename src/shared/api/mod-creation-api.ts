import { invoke } from '@tauri-apps/api/core';
import type { CreatedMod, CreateModRequest } from '@/shared/types';

export function createNewMod(request: CreateModRequest): Promise<CreatedMod> {
  return invoke('create_mod', { payload: request });
}
