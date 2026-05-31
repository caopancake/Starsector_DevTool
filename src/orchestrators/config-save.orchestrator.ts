import type { IndexedConfigKind, SkinFile, VariantFile, WriteResult } from '@/shared/types';
import type { RowData } from '@/shared/types';
import { recordFileSave, refreshProjectSessionAfterWrite } from '@/orchestrators/file-save.orchestrator';
import {
  createIndexedConfigEntity,
  saveIndexedConfigEntity,
  deleteIndexedConfigEntity,
  deleteVariantEntity,
  deleteSkinEntity,
  createVariantEntity,
  createSkinEntity,
  indexedConfigEntityData,
  skinEntityData,
  saveModInfo,
  saveSkinEntity,
  saveVariantEntity,
  variantEntityData,
} from '@/services/config-entity.service';
import { indexedConfigHistoryLabel } from '@/domain/config/config-entities';

export async function saveModInfoAction(sessionId: string, modRoot: string, data: RowData): Promise<WriteResult> {
  const result = await saveModInfo(sessionId, modRoot, data);
  await recordConfigWrite(modRoot, sessionId, result, '保存 mod_info.json');
  return result;
}

export async function saveIndexedConfigEntityAction(write: {
  sessionId: string;
  modRoot: string;
  kind: IndexedConfigKind;
  previousId: string | null;
  nextId: string;
  indexRow: RowData;
  entityData: RowData;
  deletePreviousTarget: boolean;
}): Promise<string> {
  const result = await saveIndexedConfigEntity(write);
  const entity = indexedConfigEntityData(result);
  await recordConfigWrite(write.modRoot, write.sessionId, result, indexedConfigHistoryLabel(write.kind, 'save', entity.entityId));
  return entity.entityId;
}

export async function createIndexedConfigEntityAction(write: {
  sessionId: string;
  modRoot: string;
  kind: IndexedConfigKind;
  previousId: null;
  nextId: string;
  indexRow: RowData;
  entityData: RowData;
  deletePreviousTarget: false;
}): Promise<string> {
  const result = await createIndexedConfigEntity(write);
  const entity = indexedConfigEntityData(result);
  await recordConfigWrite(write.modRoot, write.sessionId, result, indexedConfigHistoryLabel(write.kind, 'create', entity.entityId));
  return entity.entityId;
}

export async function deleteIndexedConfigEntityAction(
  sessionId: string,
  modRoot: string,
  kind: IndexedConfigKind,
  id: string,
  deleteTarget: boolean,
): Promise<string> {
  const result = await deleteIndexedConfigEntity(sessionId, modRoot, kind, id, deleteTarget);
  await recordConfigWrite(modRoot, sessionId, result, indexedConfigHistoryLabel(kind, 'delete', id));
  return indexedConfigEntityData(result).entityId;
}

export async function saveVariantAction(
  sessionId: string,
  modRoot: string,
  variantId: string,
  data: RowData,
  previousId: string | null,
  previousRelPath: string | null,
): Promise<VariantFile> {
  const result = await saveVariantEntity({
    sessionId,
    modRoot,
    previousId,
    previousRelPath,
    nextId: variantId,
    data,
  });
  const variant = variantEntityData(result);
  await recordConfigWrite(modRoot, sessionId, result, `保存装配 ${variant.variantId}`);
  return variant;
}

export async function createVariantAction(sessionId: string, modRoot: string, hullId: string, variantId: string): Promise<VariantFile> {
  const result = await createVariantEntity(sessionId, modRoot, hullId, variantId);
  const variant = variantEntityData(result);
  await recordConfigWrite(modRoot, sessionId, result, `创建装配 ${variant.variantId}`);
  return variant;
}

export async function deleteVariantAction(sessionId: string, modRoot: string, relPath: string, variantId: string): Promise<WriteResult> {
  const result = await deleteVariantEntity(sessionId, modRoot, relPath, variantId);
  await recordConfigWrite(modRoot, sessionId, result, `删除装配 ${variantId}`);
  return result;
}

export async function saveSkinAction(
  sessionId: string,
  modRoot: string,
  skinHullId: string,
  data: RowData,
  previousId: string | null,
  previousRelPath: string | null,
): Promise<SkinFile> {
  const result = await saveSkinEntity({
    sessionId,
    modRoot,
    previousId,
    previousRelPath,
    nextId: skinHullId,
    data,
  });
  const skin = skinEntityData(result);
  await recordConfigWrite(modRoot, sessionId, result, `保存舰船皮肤 ${skin.skinHullId}`);
  return skin;
}

export async function createSkinAction(sessionId: string, modRoot: string, baseHullId: string, skinHullId: string): Promise<SkinFile> {
  const result = await createSkinEntity(sessionId, modRoot, baseHullId, skinHullId);
  const skin = skinEntityData(result);
  await recordConfigWrite(modRoot, sessionId, result, `创建舰船皮肤 ${skin.skinHullId}`);
  return skin;
}

export async function deleteSkinAction(sessionId: string, modRoot: string, relPath: string, skinHullId: string): Promise<WriteResult> {
  const result = await deleteSkinEntity(sessionId, modRoot, relPath, skinHullId);
  await recordConfigWrite(modRoot, sessionId, result, `删除舰船皮肤 ${skinHullId}`);
  return result;
}

async function recordConfigWrite(modRoot: string, sessionId: string | null, result: WriteResult, label: string) {
  if (!sessionId) return;
  recordFileSave(modRoot, result, label, sessionId);
  await refreshProjectSessionAfterWrite(modRoot, result, sessionId);
}
