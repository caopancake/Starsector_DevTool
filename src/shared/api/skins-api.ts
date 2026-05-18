import { invoke } from '@tauri-apps/api/core';
import type { RowData, SkinFile } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

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

export const saveSkinEntity = saveSkinEntityWithHistory;

export function createSkinEntityWithHistory(payload: SkinEntityPayload): Promise<SkinEntityResult> {
  return invoke('create_skin_entity_with_history', { payload });
}

export const createSkinEntity = createSkinEntityWithHistory;

export function deleteSkinEntityWithHistory(payload: DeleteSkinEntityPayload): Promise<FileChangeRecord[]> {
  return invoke('delete_skin_entity_with_history', { payload });
}

export const deleteSkinEntity = deleteSkinEntityWithHistory;
