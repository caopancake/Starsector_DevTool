import { invoke } from '@tauri-apps/api/core';
import type { RowData, SkinFile } from '../types';
import type { FileChangeRecord } from './files-api';

export interface SkinEntityPayload {
  modRoot: string;
  previousId?: string | null;
  previousRelPath?: string | null;
  nextId: string;
  data: RowData;
}

export interface DeleteSkinEntityPayload {
  modRoot: string;
  skinHullId: string;
  relPath: string;
}

export interface SkinEntityResult {
  changes: FileChangeRecord[];
  skinFile: SkinFile;
}

export function saveSkinEntityWithHistory(payload: SkinEntityPayload): Promise<SkinEntityResult> {
  return invoke('save_skin_entity_with_history', { payload });
}

export function createSkinEntityWithHistory(payload: SkinEntityPayload): Promise<SkinEntityResult> {
  return invoke('create_skin_entity_with_history', { payload });
}

export function deleteSkinEntityWithHistory(payload: DeleteSkinEntityPayload): Promise<FileChangeRecord[]> {
  return invoke('delete_skin_entity_with_history', { payload });
}
