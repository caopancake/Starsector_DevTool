import { invoke } from '@tauri-apps/api/core';
import type { ConfigFileEntityPayload, VariantFile } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

export type VariantEntityPayload = ConfigFileEntityPayload;

export interface DeleteVariantEntityPayload {
  modRoot: string;
  variantId: string;
  relPath: string;
}

export interface VariantEntityResult {
  changes: FileChangeRecord[];
  variantFile: VariantFile;
}

export function saveVariantEntityWithHistory(payload: VariantEntityPayload): Promise<VariantEntityResult> {
  return invoke('save_variant_entity_with_history', { payload });
}

export const saveVariantEntity = saveVariantEntityWithHistory;

export function createVariantEntityWithHistory(payload: VariantEntityPayload): Promise<VariantEntityResult> {
  return invoke('create_variant_entity_with_history', { payload });
}

export const createVariantEntity = createVariantEntityWithHistory;

export function deleteVariantEntityWithHistory(payload: DeleteVariantEntityPayload): Promise<FileChangeRecord[]> {
  return invoke('delete_variant_entity_with_history', { payload });
}

export const deleteVariantEntity = deleteVariantEntityWithHistory;
