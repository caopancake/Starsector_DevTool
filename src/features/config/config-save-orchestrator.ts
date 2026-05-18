import type { FileChangeRecord } from '../../shared/api/files-api';
import type { IndexedConfigEntityKind, IndexedConfigEntityResult } from '../../shared/api/indexed-api';
import type { SkinEntityResult } from '../../shared/api/skins-api';
import type { VariantEntityResult } from '../../shared/api/variants-api';
import type { RowData } from '../../shared/types';
import { recordFileSave } from '../file-history/file-save-orchestrator';
import {
  saveIndexedConfigEntityData,
  deleteIndexedConfigEntityData,
  deleteVariantEntityData,
  deleteSkinEntityData,
  createVariantEntityData,
  createSkinEntityData,
  saveModInfoData,
  saveSkinEntityData,
  saveVariantEntityData,
} from './config-service';

export async function saveModInfoWithFileHistory(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  const changes = await saveModInfoData(modRoot, data);
  recordConfigFileSave(modRoot, changes, '保存 mod_info.json');
  return changes;
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
  const result = await saveIndexedConfigEntityData(payload);
  recordConfigFileSave(payload.modRoot, result.changes, indexedEntitySaveLabel(payload.kind, result.entityId));
  return result;
}

export async function createIndexedConfigEntityWithFileHistory(payload: {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
}): Promise<IndexedConfigEntityResult> {
  const result = await saveIndexedConfigEntityData(payload);
  recordConfigFileSave(payload.modRoot, result.changes, indexedEntityCreateLabel(payload.kind, result.entityId));
  return result;
}

export async function deleteIndexedConfigEntityWithFileHistory(
  modRoot: string,
  kind: IndexedConfigEntityKind,
  id: string,
  deleteTarget = false,
): Promise<IndexedConfigEntityResult> {
  const result = await deleteIndexedConfigEntityData(modRoot, kind, id, deleteTarget);
  recordConfigFileSave(modRoot, result.changes, indexedEntityDeleteLabel(kind, id));
  return result;
}

export async function saveVariantWithFileHistory(
  modRoot: string,
  variantId: string,
  data: RowData,
  previousId?: string | null,
  previousRelPath?: string | null,
): Promise<VariantEntityResult> {
  const result = await saveVariantEntityData({
    modRoot,
    previousId,
    previousRelPath,
    nextId: variantId,
    data,
  });
  recordConfigFileSave(modRoot, result.changes, `保存装配 ${variantId}`);
  return result;
}

export async function createVariantWithFileHistory(modRoot: string, hullId: string, variantId: string): Promise<VariantEntityResult> {
  const result = await createVariantEntityData(modRoot, hullId, variantId);
  recordConfigFileSave(modRoot, result.changes, `创建装配 ${variantId}`);
  return result;
}

export async function deleteVariantWithFileHistory(modRoot: string, relPath: string, variantId: string): Promise<FileChangeRecord[]> {
  const changes = await deleteVariantEntityData(modRoot, relPath, variantId);
  recordConfigFileSave(modRoot, changes, `删除装配 ${variantId}`);
  return changes;
}

export async function saveSkinWithFileHistory(
  modRoot: string,
  skinHullId: string,
  data: RowData,
  previousId?: string | null,
  previousRelPath?: string | null,
): Promise<SkinEntityResult> {
  const result = await saveSkinEntityData({
    modRoot,
    previousId,
    previousRelPath,
    nextId: skinHullId,
    data,
  });
  recordConfigFileSave(modRoot, result.changes, `保存舰船皮肤 ${skinHullId}`);
  return result;
}

export async function createSkinWithFileHistory(modRoot: string, baseHullId: string, skinHullId: string): Promise<SkinEntityResult> {
  const result = await createSkinEntityData(modRoot, baseHullId, skinHullId);
  recordConfigFileSave(modRoot, result.changes, `创建舰船皮肤 ${skinHullId}`);
  return result;
}

export async function deleteSkinWithFileHistory(modRoot: string, relPath: string, skinHullId: string): Promise<FileChangeRecord[]> {
  const changes = await deleteSkinEntityData(modRoot, relPath, skinHullId);
  recordConfigFileSave(modRoot, changes, `删除舰船皮肤 ${skinHullId}`);
  return changes;
}

function recordConfigFileSave(modRoot: string, changes: FileChangeRecord[], label: string) {
  recordFileSave(modRoot, changes, label);
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
