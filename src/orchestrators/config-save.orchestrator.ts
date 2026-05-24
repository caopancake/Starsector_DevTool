import type {
  FileChangeRecord,
  IndexedConfigEntityKind,
  IndexedConfigEntityResult,
  SkinEntityResult,
  VariantEntityResult,
} from '@/shared/api/write-api';
import type { RowData } from '@/shared/types';
import { recordFileSave, invalidateWriteResultForMod } from '@/orchestrators/file-save.orchestrator';
import {
  saveIndexedConfigEntity,
  deleteIndexedConfigEntity,
  deleteVariantEntity,
  deleteSkinEntity,
  createVariantEntity,
  createSkinEntity,
  saveModInfo,
  saveSkinEntity,
  saveVariantEntity,
} from '@/services/config-entity.service';

export async function saveModInfoWithFileHistory(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  const result = await saveModInfo(modRoot, data);
  await recordConfigWrite(modRoot, result, '保存 mod_info.json');
  return result.changes;
}

export async function saveIndexedConfigEntityWithFileHistory(payload: {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  previousId?: string | null;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
  deletePreviousTarget?: boolean;
}): Promise<IndexedConfigEntityResult> {
  const result = await saveIndexedConfigEntity(payload);
  await recordConfigWrite(payload.modRoot, result, indexedEntitySaveLabel(payload.kind, result.entityId));
  return result;
}

export async function createIndexedConfigEntityWithFileHistory(payload: {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
}): Promise<IndexedConfigEntityResult> {
  const result = await saveIndexedConfigEntity(payload);
  await recordConfigWrite(payload.modRoot, result, indexedEntityCreateLabel(payload.kind, result.entityId));
  return result;
}

export async function deleteIndexedConfigEntityWithFileHistory(
  modRoot: string,
  kind: IndexedConfigEntityKind,
  id: string,
  deleteTarget = false,
): Promise<IndexedConfigEntityResult> {
  const result = await deleteIndexedConfigEntity(modRoot, kind, id, deleteTarget);
  await recordConfigWrite(modRoot, result, indexedEntityDeleteLabel(kind, id));
  return result;
}

export async function saveVariantWithFileHistory(
  modRoot: string,
  variantId: string,
  data: RowData,
  previousId?: string | null,
  previousRelPath?: string | null,
): Promise<VariantEntityResult> {
  const result = await saveVariantEntity({
    modRoot,
    previousId,
    previousRelPath,
    nextId: variantId,
    data,
  });
  await recordConfigWrite(modRoot, result, `保存装配 ${variantId}`);
  return result;
}

export async function createVariantWithFileHistory(modRoot: string, hullId: string, variantId: string): Promise<VariantEntityResult> {
  const result = await createVariantEntity(modRoot, hullId, variantId);
  await recordConfigWrite(modRoot, result, `创建装配 ${variantId}`);
  return result;
}

export async function deleteVariantWithFileHistory(modRoot: string, relPath: string, variantId: string): Promise<FileChangeRecord[]> {
  const result = await deleteVariantEntity(modRoot, relPath, variantId);
  await recordConfigWrite(modRoot, result, `删除装配 ${variantId}`);
  return result.changes;
}

export async function saveSkinWithFileHistory(
  modRoot: string,
  skinHullId: string,
  data: RowData,
  previousId?: string | null,
  previousRelPath?: string | null,
): Promise<SkinEntityResult> {
  const result = await saveSkinEntity({
    modRoot,
    previousId,
    previousRelPath,
    nextId: skinHullId,
    data,
  });
  await recordConfigWrite(modRoot, result, `保存舰船皮肤 ${skinHullId}`);
  return result;
}

export async function createSkinWithFileHistory(modRoot: string, baseHullId: string, skinHullId: string): Promise<SkinEntityResult> {
  const result = await createSkinEntity(modRoot, baseHullId, skinHullId);
  await recordConfigWrite(modRoot, result, `创建舰船皮肤 ${skinHullId}`);
  return result;
}

export async function deleteSkinWithFileHistory(modRoot: string, relPath: string, skinHullId: string): Promise<FileChangeRecord[]> {
  const result = await deleteSkinEntity(modRoot, relPath, skinHullId);
  await recordConfigWrite(modRoot, result, `删除舰船皮肤 ${skinHullId}`);
  return result.changes;
}

async function recordConfigWrite(modRoot: string, result: { changes: FileChangeRecord[]; invalidatedPaths: string[] }, label: string) {
  recordFileSave(modRoot, result.changes, label);
  await invalidateWriteResultForMod(modRoot, result);
}

function indexedEntitySaveLabel(kind: IndexedConfigEntityKind, id: string): string {
  return kind === 'faction' ? `保存 ${id}.faction` : `保存战役 ${id}`;
}

function indexedEntityCreateLabel(kind: IndexedConfigEntityKind, id: string): string {
  return kind === 'faction' ? `创建势力 ${id}` : `创建战役 ${id}`;
}

function indexedEntityDeleteLabel(kind: IndexedConfigEntityKind, id: string): string {
  return kind === 'faction' ? `删除势力 ${id}` : `删除战役 ${id}`;
}
