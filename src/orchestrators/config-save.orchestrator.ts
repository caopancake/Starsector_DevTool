import type { IndexedConfigKind, SkinFile, VariantFile, WriteResult } from '@/shared/types';
import type { RowData } from '@/shared/types';
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
import { useProjectStore } from '@/stores/project.store';
import { completeSavedWrite } from '@/orchestrators/file-history-session.orchestrator';

export async function saveModInfoAction(sessionId: string, modRoot: string, data: RowData): Promise<WriteResult> {
  const result = await saveModInfo(sessionId, modRoot, data);
  await recordConfigWrite(modRoot, sessionId, result, '保存 mod_info.json');
  return result;
}

export async function saveIndexedEntityAction(write: {
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

export async function createIndexedEntityAction(write: {
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

export async function deleteIndexedEntityAction(
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
): Promise<VariantFile> {
  const result = await saveVariantEntity({
    sessionId,
    modRoot,
    previousId,
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
): Promise<SkinFile> {
  const result = await saveSkinEntity({
    sessionId,
    modRoot,
    previousId,
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

async function recordConfigWrite(modRoot: string, sessionId: string, result: WriteResult, label: string) {
  await completeSavedWrite({ modRoot, sessionId, result, label }, useProjectStore());
}
