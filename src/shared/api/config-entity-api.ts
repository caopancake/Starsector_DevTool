import { invoke } from '@tauri-apps/api/core';
import type {
  DeleteIndexedConfigEntityWrite,
  DeleteSkinEntityWrite,
  DeleteVariantEntityWrite,
  IndexedConfigEntityWrite,
  SkinEntityWrite,
  VariantEntityWrite,
  WriteResult,
} from '@/shared/types';

export function saveIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('save_indexed_config_entity', {
    payload: {
      modRoot: write.modRoot,
      sessionId: write.sessionId,
      kind: write.kind,
      previousId: write.previousId,
      nextId: write.nextId,
      indexRow: write.indexRow,
      entityData: write.entityData,
      deletePreviousTarget: write.deletePreviousTarget,
    },
  });
}

export function createIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('create_indexed_config_entity', {
    payload: {
      modRoot: write.modRoot,
      sessionId: write.sessionId,
      kind: write.kind,
      previousId: write.previousId,
      nextId: write.nextId,
      indexRow: write.indexRow,
      entityData: write.entityData,
      deletePreviousTarget: write.deletePreviousTarget,
    },
  });
}

export function deleteIndexedConfigEntity(write: DeleteIndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('delete_indexed_config_entity', { payload: write });
}

export function saveVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return invoke('save_variant_entity', { payload: write });
}

export function createVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return invoke('create_variant_entity', { payload: write });
}

export function deleteVariantEntity(write: DeleteVariantEntityWrite): Promise<WriteResult> {
  return invoke('delete_variant_entity', { payload: write });
}

export function saveSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return invoke('save_skin_entity', { payload: write });
}

export function createSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return invoke('create_skin_entity', { payload: write });
}

export function deleteSkinEntity(write: DeleteSkinEntityWrite): Promise<WriteResult> {
  return invoke('delete_skin_entity', { payload: write });
}
