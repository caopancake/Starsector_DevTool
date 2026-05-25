import type {
  EntityData,
  IndexedConfigKind,
  IndexedConfigEntityData,
  IndexedConfigEntityWrite,
  ProjectSessionId,
  ConfigMissionEditorData,
  RowData,
  SkinEntityWrite,
  SkinFile,
  VariantFile,
  VariantEntityWrite,
  WriteResult,
} from '@/shared/types';
import { querySessionEntity, querySessionEntityList } from '@/services/query.service';
import {
  hydrateFactionCrests,
  hydrateFactionPreviewImages,
  hydrateMissionIcon,
  hydrateMissionIcons,
} from '@/services/config-resource.service';
import {
  writeCreateIndexedConfigEntity,
  writeCreateSkinEntity,
  writeCreateVariantEntity,
  writeDeleteIndexedConfigEntity,
  writeDeleteSkinEntity,
  writeDeleteVariantEntity,
  writeIndexedConfigEntity,
  writeModFiles,
  writeSkinEntity,
  writeVariantEntity,
} from '@/services/write.service';
import { createDefaultSkin, createDefaultVariant } from '@/domain/config/config-entities';
import { AppError } from '@/shared/lib/errors';
import { requireRowData } from '@/shared/lib/row-data';

export type { IndexedConfigKind };

export interface ConfigFactionRecord {
  id: string;
  data: RowData;
  crestSrc: string;
}

export interface ConfigFactionPreviewImages {
  logoSrc: string;
  crestSrc: string;
}

export interface ConfigMissionRecord {
  id: string;
  list: RowData;
  iconSrc: string;
}

async function listFactionEntityRecords(sessionId: ProjectSessionId): Promise<EntityData[]> {
  return querySessionEntityList(sessionId, 'faction');
}

async function getFactionEntityRecord(sessionId: ProjectSessionId, id: string): Promise<EntityData | null> {
  return querySessionEntity(sessionId, 'faction', id);
}

async function listMissionEntities(sessionId: ProjectSessionId): Promise<EntityData[]> {
  return querySessionEntityList(sessionId, 'mission');
}

async function getMissionEntity(sessionId: ProjectSessionId, id: string): Promise<EntityData | null> {
  return querySessionEntity(sessionId, 'mission', id);
}

export async function listConfigFactionRecords(sessionId: ProjectSessionId): Promise<ConfigFactionRecord[]> {
  const entities = await listFactionEntityRecords(sessionId);
  const crestById = await hydrateFactionCrests(sessionId, entities);
  return entities.map((entity) => ({
    id: entity.id,
    data: requireConfigRowData(entity.data, `势力 ${entity.id} 数据无效`),
    crestSrc: crestById[entity.id] ?? '',
  }));
}

export async function queryConfigFactionPreviewImages(sessionId: ProjectSessionId, id: string): Promise<ConfigFactionPreviewImages> {
  const entity = await getFactionEntityRecord(sessionId, id);
  return hydrateFactionPreviewImages(sessionId, entity);
}

export async function listConfigMissionRecords(sessionId: ProjectSessionId): Promise<ConfigMissionRecord[]> {
  const entities = await listMissionEntities(sessionId);
  const iconById = await hydrateMissionIcons(sessionId, entities);
  return entities.map((entity) => {
    const data = requireConfigRowData(entity.data, `战役 ${entity.id} 数据无效`);
    return {
      id: entity.id,
      list: { ...requireConfigRowData(data.list, `战役 ${entity.id} 列表数据无效`), id: entity.id },
      iconSrc: iconById[entity.id] ?? '',
    };
  });
}

export async function getConfigMissionEditorData(sessionId: ProjectSessionId, id: string): Promise<ConfigMissionEditorData | null> {
  const entity = await getMissionEntity(sessionId, id);
  if (!entity) return null;
  const data = requireConfigRowData(entity.data, `战役 ${id} 数据无效`);
  const iconSrc = await hydrateMissionIcon(sessionId, entity);
  return {
    list: requireConfigRowData(data.list, `战役 ${id} 列表数据无效`),
    descriptor: requireConfigRowData(data.descriptor, `战役 ${id} descriptor 数据无效`),
    text: stringField(data, 'text', `战役 ${id} 文本数据无效`),
    iconSrc,
  };
}

export async function listVariantEntities(sessionId: ProjectSessionId): Promise<VariantFile[]> {
  return (await querySessionEntityList(sessionId, 'variant')).map((entity) => variantFileFromEntityData(entity.data));
}

export async function listSkinEntities(sessionId: ProjectSessionId): Promise<SkinFile[]> {
  return (await querySessionEntityList(sessionId, 'skin')).map((entity) => skinFileFromEntityData(entity.data));
}

export function saveModInfo(modRoot: string, data: RowData): Promise<WriteResult> {
  return writeModFiles(modRoot, [{ relPath: 'mod_info.json', afterText: JSON.stringify(data, null, 2), afterDataBase64: null }]);
}

export function saveIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return writeIndexedConfigEntity(write);
}

export function createIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return writeCreateIndexedConfigEntity(write);
}

export function deleteIndexedConfigEntity(
  modRoot: string,
  kind: IndexedConfigKind,
  id: string,
  deleteTarget: boolean,
): Promise<WriteResult> {
  return writeDeleteIndexedConfigEntity({ modRoot, kind, id, deleteTarget });
}

export function saveVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return writeVariantEntity(write);
}

export function createVariantEntity(modRoot: string, hullId: string, variantId: string): Promise<WriteResult> {
  return writeCreateVariantEntity({
    modRoot,
    previousId: null,
    previousRelPath: null,
    nextId: variantId,
    data: createDefaultVariant(hullId, variantId),
  });
}

export function deleteVariantEntity(modRoot: string, relPath: string, variantId: string): Promise<WriteResult> {
  return writeDeleteVariantEntity({ modRoot, relPath, variantId });
}

export function saveSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return writeSkinEntity(write);
}

export function createSkinEntity(modRoot: string, baseHullId: string, skinHullId: string): Promise<WriteResult> {
  return writeCreateSkinEntity({
    modRoot,
    previousId: null,
    previousRelPath: null,
    nextId: skinHullId,
    data: createDefaultSkin(baseHullId, skinHullId),
  });
}

export function deleteSkinEntity(modRoot: string, relPath: string, skinHullId: string): Promise<WriteResult> {
  return writeDeleteSkinEntity({ modRoot, relPath, skinHullId });
}

export function indexedConfigEntityData(result: WriteResult): IndexedConfigEntityData {
  const row = requireConfigRowData(result.refreshedEntity, '配置保存返回数据无效');
  return {
    entityId: stringField(row, 'entityId', '配置保存返回 entityId 无效'),
    indexPath: stringField(row, 'indexPath', '配置保存返回 indexPath 无效'),
    indexHeader: stringArrayField(row, 'indexHeader', '配置保存返回 indexHeader 无效'),
    indexRows: rowDataArrayField(row, 'indexRows', '配置保存返回 indexRows 无效'),
    entityData: row.entityData === null ? null : requireConfigRowData(row.entityData, '配置保存返回 entityData 无效'),
  };
}

export function variantEntityData(result: WriteResult): VariantFile {
  return variantFileFromEntityData(result.refreshedEntity);
}

export function skinEntityData(result: WriteResult): SkinFile {
  return skinFileFromEntityData(result.refreshedEntity);
}

function requireConfigRowData(value: unknown, message: string): RowData {
  return requireRowData(value, message);
}

function variantFileFromEntityData(value: unknown): VariantFile {
  const row = requireConfigRowData(value, '装配数据无效');
  return {
    variantId: stringField(row, 'variantId', '装配 variantId 无效'),
    hullId: stringField(row, 'hullId', '装配 hullId 无效'),
    path: stringField(row, 'path', '装配 path 无效'),
    relPath: stringField(row, 'relPath', '装配 relPath 无效'),
    data: requireConfigRowData(row.data, '装配文件内容无效'),
    weaponGroupCount: numberField(row, 'weaponGroupCount', '装配 weaponGroupCount 无效'),
    hullModCount: numberField(row, 'hullModCount', '装配 hullModCount 无效'),
    permaModCount: numberField(row, 'permaModCount', '装配 permaModCount 无效'),
    wingCount: numberField(row, 'wingCount', '装配 wingCount 无效'),
  };
}

function skinFileFromEntityData(value: unknown): SkinFile {
  const row = requireConfigRowData(value, '舰船皮肤数据无效');
  return {
    skinHullId: stringField(row, 'skinHullId', '舰船皮肤 skinHullId 无效'),
    baseHullId: stringField(row, 'baseHullId', '舰船皮肤 baseHullId 无效'),
    path: stringField(row, 'path', '舰船皮肤 path 无效'),
    relPath: stringField(row, 'relPath', '舰船皮肤 relPath 无效'),
    data: requireConfigRowData(row.data, '舰船皮肤文件内容无效'),
    builtInModCount: numberField(row, 'builtInModCount', '舰船皮肤 builtInModCount 无效'),
    builtInWeaponCount: numberField(row, 'builtInWeaponCount', '舰船皮肤 builtInWeaponCount 无效'),
    builtInWingCount: numberField(row, 'builtInWingCount', '舰船皮肤 builtInWingCount 无效'),
    weaponSlotChangeCount: numberField(row, 'weaponSlotChangeCount', '舰船皮肤 weaponSlotChangeCount 无效'),
    engineSlotChangeCount: numberField(row, 'engineSlotChangeCount', '舰船皮肤 engineSlotChangeCount 无效'),
  };
}

function stringField(row: RowData, key: string, message: string): string {
  const value = row[key];
  if (typeof value === 'string') return value;
  throw new AppError(message, { action: 'read-config-entity' });
}

function numberField(row: RowData, key: string, message: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new AppError(message, { action: 'read-config-entity' });
}

function stringArrayField(row: RowData, key: string, message: string): string[] {
  const value = row[key];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw new AppError(message, { action: 'read-config-entity' });
}

function rowDataArrayField(row: RowData, key: string, message: string): RowData[] {
  const value = row[key];
  if (Array.isArray(value)) return value.map((item) => requireConfigRowData(item, message));
  throw new AppError(message, { action: 'read-config-entity' });
}
