import {
  createIndexedConfigEntityWithHistory,
  deleteIndexedConfigEntityWithHistory,
  saveIndexedConfigEntityWithHistory,
  type IndexedConfigEntityKind,
  type IndexedConfigEntityResult,
} from '../../shared/api/indexed-api';
import { loadMission, loadMissionListCsv, scanMissionList, type MissionData } from '../../shared/api/missions-api';
import {
  createVariantEntityWithHistory,
  deleteVariantEntityWithHistory,
  saveVariantEntityWithHistory,
  type VariantEntityResult,
} from '../../shared/api/variants-api';
import { saveModFilesWithHistory, type FileChangeRecord } from '../../shared/api/files-api';
import type { CsvTable } from '../../shared/api/tables-api';
import { AppError, withCause } from '../../shared/lib/errors';
import type { JsonValue, RowData } from '../../shared/types';

export async function saveModInfoData(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  if (!modRoot) {
    throw new AppError('缺少 mod 根目录', { action: 'save-mod-info' });
  }
  try {
    return await saveModFilesWithHistory(modRoot, [
      { relPath: 'mod_info.json', afterText: JSON.stringify(stripInternalFields(data), null, 2) },
    ]);
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

export async function loadMissionListData(modRoot: string, relPath: string): Promise<CsvTable> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission-list' });
  try {
    return await loadMissionListCsv(modRoot, relPath);
  } catch (error) {
    throw withCause('读取 mission_list.csv 失败', error, 'load-mission-list');
  }
}

export async function loadMissionData(modRoot: string, mission: string): Promise<MissionData> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission' });
  try {
    return await loadMission(modRoot, mission);
  } catch (error) {
    throw withCause(`读取战役 ${mission} 失败`, error, 'load-mission');
  }
}

export async function saveIndexedConfigEntityData(payload: {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  previousId?: string | null;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
  deletePreviousTarget?: boolean;
}): Promise<IndexedConfigEntityResult> {
  if (!payload.modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-indexed-entity' });
  const action = payload.previousId ? saveIndexedConfigEntityWithHistory : createIndexedConfigEntityWithHistory;
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

export async function deleteIndexedConfigEntityData(
  modRoot: string,
  kind: IndexedConfigEntityKind,
  id: string,
  deleteTarget: boolean,
): Promise<IndexedConfigEntityResult> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-indexed-entity' });
  return await deleteIndexedConfigEntityWithHistory({ modRoot, kind, id, deleteTarget });
}

export async function saveVariantEntityData(payload: {
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
    return await saveVariantEntityWithHistory({
      modRoot: payload.modRoot,
      previousId: payload.previousId ?? null,
      previousRelPath: payload.previousRelPath ?? null,
      nextId: payload.nextId,
      data: stripInternalFields(payload.data) as RowData,
    });
  } catch (error) {
    throw withCause(`保存装配 ${variantId} 失败`, error, 'save-variant');
  }
}

export async function createVariantEntityData(modRoot: string, hullId: string, variantId: string): Promise<VariantEntityResult> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'create-variant' });
  if (!isSafeFileStem(variantId)) throw new AppError('variantId 不能包含路径分隔符或 ..', { action: 'create-variant' });
  try {
    return await createVariantEntityWithHistory({
      modRoot,
      nextId: variantId,
      data: defaultVariantData(hullId, variantId),
    });
  } catch (error) {
    throw withCause(`新建装配 ${variantId} 失败`, error, 'create-variant');
  }
}

export async function deleteVariantEntityData(modRoot: string, relPath: string, variantId: string): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-variant' });
  try {
    return await deleteVariantEntityWithHistory({ modRoot, relPath, variantId });
  } catch (error) {
    throw withCause(`删除装配 ${variantId} 失败`, error, 'delete-variant');
  }
}

export function defaultVariantData(hullId: string, variantId: string): RowData {
  return {
    variantId,
    hullId,
    displayName: variantId,
    goalVariant: false,
    fluxVents: 0,
    fluxCapacitors: 0,
    hullMods: [],
    permaMods: [],
    sMods: [],
    weaponGroups: [],
    wings: [],
  };
}

export function defaultFactionData(id: string): RowData {
  return {
    id,
    displayName: id,
    displayNameLong: id,
    color: [128, 128, 128, 255],
    baseColor: [128, 128, 128, 255],
    darkColor: [64, 64, 64, 255],
    shipNamePrefix: '',
    knownShips: { tags: [] },
    knownWeapons: { tags: [] },
    knownFighters: { tags: [] },
  };
}

export function factionIndexRow(id: string): RowData {
  return {
    id,
    file: `data/world/factions/${id}.faction`,
  };
}

export function missionIndexRow(rows: RowData[], header: string[], mission: string): RowData {
  const row = rows.find((item) => String(item.mission ?? '').trim() === mission) ?? {};
  const result: RowData = {};
  for (const col of header.length ? header : ['mission']) {
    result[col] = row[col] ?? '';
  }
  for (const [key, value] of Object.entries(row)) {
    if (!(key in result)) result[key] = value;
  }
  result.mission = mission;
  return result;
}

export function isSafeFileStem(value: string): boolean {
  return value.length > 0 && !value.includes('/') && !value.includes('\\') && value !== '.' && value !== '..' && !value.includes('..');
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function stripInternalFields(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stripInternalFields);
  if (!value || typeof value !== 'object') return value;
  const result: RowData = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    result[key] = stripInternalFields(item);
  }
  return result;
}
