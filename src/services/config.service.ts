import {
  createIndexedConfigEntity as createIndexedConfigEntityApi,
  deleteIndexedConfigEntity as deleteIndexedConfigEntityApi,
  saveIndexedConfigEntity as saveIndexedConfigEntityApi,
  type IndexedConfigEntityKind,
  type IndexedConfigEntityResult,
} from '@/shared/api/indexed-api';
import { loadMission as loadMissionApi, loadMissionListCsv, scanMissionList, type MissionData } from '@/shared/api/missions-api';
import {
  createSkinEntity as createSkinEntityApi,
  deleteSkinEntity as deleteSkinEntityApi,
  saveSkinEntity as saveSkinEntityApi,
  type SkinEntityResult,
} from '@/shared/api/skins-api';
import {
  createVariantEntity as createVariantEntityApi,
  deleteVariantEntity as deleteVariantEntityApi,
  saveVariantEntity as saveVariantEntityApi,
  type VariantEntityResult,
} from '@/shared/api/variants-api';
import { saveModFiles, type FileChangeRecord } from '@/shared/api/files-api';
import type { CsvTable } from '@/shared/api/tables-api';
import { createDefaultSkin, createDefaultVariant, isSafeEntityFileStem, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { AppError, withCause } from '@/shared/lib/errors';
import type { RowData } from '@/shared/types';

export async function saveModInfo(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  if (!modRoot) {
    throw new AppError('缺少 mod 根目录', { action: 'save-mod-info' });
  }
  try {
    return await saveModFiles(modRoot, [{ relPath: 'mod_info.json', afterText: JSON.stringify(stripSchemaInternalFields(data), null, 2) }]);
  } catch (error) {
    throw withCause('保存 mod_info.json 失败', error, 'save-mod-info');
  }
}

export async function scanMissionListFiles(modRoot: string): Promise<string[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'scan-mission-list' });
  try {
    return await scanMissionList(modRoot);
  } catch (error) {
    throw withCause('扫描战役列表失败', error, 'scan-mission-list');
  }
}

export async function loadMissionList(modRoot: string, relPath: string): Promise<CsvTable> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission-list' });
  try {
    return await loadMissionListCsv(modRoot, relPath);
  } catch (error) {
    throw withCause('读取 mission_list.csv 失败', error, 'load-mission-list');
  }
}

export async function loadMission(modRoot: string, mission: string): Promise<MissionData> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission' });
  try {
    return await loadMissionApi(modRoot, mission);
  } catch (error) {
    throw withCause(`读取战役 ${mission} 失败`, error, 'load-mission');
  }
}

export async function saveIndexedConfigEntity(payload: {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  previousId?: string | null;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
  deletePreviousTarget?: boolean;
}): Promise<IndexedConfigEntityResult> {
  if (!payload.modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-indexed-entity' });
  const action = payload.previousId ? saveIndexedConfigEntityApi : createIndexedConfigEntityApi;
  return await action({
    modRoot: payload.modRoot,
    kind: payload.kind,
    previousId: payload.previousId ?? null,
    nextId: payload.nextId,
    indexRow: payload.indexRow,
    payload: payload.payload,
    deletePreviousTarget: payload.deletePreviousTarget ?? false,
  });
}

export async function deleteIndexedConfigEntity(
  modRoot: string,
  kind: IndexedConfigEntityKind,
  id: string,
  deleteTarget: boolean,
): Promise<IndexedConfigEntityResult> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-indexed-entity' });
  return await deleteIndexedConfigEntityApi({ modRoot, kind, id, deleteTarget });
}

export async function saveVariantEntity(payload: {
  modRoot: string;
  previousId?: string | null;
  previousRelPath?: string | null;
  nextId: string;
  data: RowData;
}): Promise<VariantEntityResult> {
  const variantId = stringField(payload.data, 'variantId');
  if (!payload.modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-variant' });
  if (!variantId) throw new AppError('variantId 不能为空', { action: 'save-variant' });
  try {
    return await saveVariantEntityApi({
      modRoot: payload.modRoot,
      previousId: payload.previousId ?? null,
      previousRelPath: payload.previousRelPath ?? null,
      nextId: payload.nextId,
      data: stripSchemaInternalFields(payload.data) as RowData,
    });
  } catch (error) {
    throw withCause(`保存装配 ${variantId} 失败`, error, 'save-variant');
  }
}

export async function createVariantEntity(modRoot: string, hullId: string, variantId: string): Promise<VariantEntityResult> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'create-variant' });
  if (!isSafeEntityFileStem(variantId)) throw new AppError('variantId 不能包含路径分隔符或 ..', { action: 'create-variant' });
  try {
    return await createVariantEntityApi({
      modRoot,
      nextId: variantId,
      data: createDefaultVariant(hullId, variantId),
    });
  } catch (error) {
    throw withCause(`新建装配 ${variantId} 失败`, error, 'create-variant');
  }
}

export async function deleteVariantEntity(modRoot: string, relPath: string, variantId: string): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-variant' });
  try {
    return await deleteVariantEntityApi({ modRoot, relPath, variantId });
  } catch (error) {
    throw withCause(`删除装配 ${variantId} 失败`, error, 'delete-variant');
  }
}

export async function saveSkinEntity(payload: {
  modRoot: string;
  previousId?: string | null;
  previousRelPath?: string | null;
  nextId: string;
  data: RowData;
}): Promise<SkinEntityResult> {
  const skinHullId = stringField(payload.data, 'skinHullId');
  if (!payload.modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-skin' });
  if (!skinHullId) throw new AppError('skinHullId 不能为空', { action: 'save-skin' });
  try {
    return await saveSkinEntityApi({
      modRoot: payload.modRoot,
      previousId: payload.previousId ?? null,
      previousRelPath: payload.previousRelPath ?? null,
      nextId: payload.nextId,
      data: stripSchemaInternalFields(payload.data) as RowData,
    });
  } catch (error) {
    throw withCause(`保存舰船皮肤 ${skinHullId} 失败`, error, 'save-skin');
  }
}

export async function createSkinEntity(modRoot: string, baseHullId: string, skinHullId: string): Promise<SkinEntityResult> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'create-skin' });
  if (!isSafeEntityFileStem(skinHullId)) throw new AppError('skinHullId 不能包含路径分隔符或 ..', { action: 'create-skin' });
  try {
    return await createSkinEntityApi({
      modRoot,
      nextId: skinHullId,
      data: createDefaultSkin(baseHullId, skinHullId),
    });
  } catch (error) {
    throw withCause(`新建舰船皮肤 ${skinHullId} 失败`, error, 'create-skin');
  }
}

export async function deleteSkinEntity(modRoot: string, relPath: string, skinHullId: string): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-skin' });
  try {
    return await deleteSkinEntityApi({ modRoot, relPath, skinHullId });
  } catch (error) {
    throw withCause(`删除舰船皮肤 ${skinHullId} 失败`, error, 'delete-skin');
  }
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}
