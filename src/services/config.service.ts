import {
  createIndexedConfigEntity as createIndexedConfigEntityApi,
  deleteIndexedConfigEntity as deleteIndexedConfigEntityApi,
  saveIndexedConfigEntity as saveIndexedConfigEntityApi,
  type IndexedConfigEntityKind,
  type IndexedConfigEntityResult,
} from '@/shared/api/indexed-api';
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
import { queryEntity, queryEntityList as queryEntityListApi, queryHullReferences } from '@/shared/api/project-api';
import { createDefaultSkin, createDefaultVariant, isSafeEntityFileStem, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { AppError, withCause } from '@/shared/lib/errors';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import type { SelectOption } from '@/domain/schema/schema-registry';
import type { EntityData, HullReferenceOption, ProjectSessionId, ResourceRef, RowData, SkinFile, VariantFile } from '@/shared/types';

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

export async function listFactionEntities(sessionId: ProjectSessionId): Promise<Record<string, RowData>> {
  return Object.fromEntries((await queryEntityListApi({ sessionId, kind: 'faction' })).map((item) => [item.id, item.data as RowData]));
}

export async function listVariantEntities(sessionId: ProjectSessionId): Promise<VariantFile[]> {
  return (await queryEntityListApi({ sessionId, kind: 'variant' })).map((item) => item.data as unknown as VariantFile);
}

export async function listSkinEntities(sessionId: ProjectSessionId): Promise<SkinFile[]> {
  return (await queryEntityListApi({ sessionId, kind: 'skin' })).map((item) => item.data as unknown as SkinFile);
}

export async function listMissionEntities(sessionId: ProjectSessionId): Promise<MissionEntity[]> {
  return (await queryEntityListApi({ sessionId, kind: 'mission' })).map(missionEntityFromQuery);
}

export async function getMissionEntity(sessionId: ProjectSessionId, missionId: string): Promise<MissionEntity> {
  const entity = await queryEntity({ sessionId, kind: 'mission', id: missionId });
  if (!entity) throw new AppError(`战役 ${missionId} 不存在`, { action: 'query-mission-entity' });
  return missionEntityFromQuery(entity);
}

export async function queryHullReferenceOptions(sessionId: ProjectSessionId): Promise<SelectOption[]> {
  const references = await queryHullReferences({ sessionId, hullIds: [] });
  const options = references.groups.map((group) => ({
    type: 'group' as const,
    label: group.label,
    value: `__${group.label}`,
    children: group.options.map(hullOptionToSelectOption),
  }));
  await hydrateSelectOptionSprites(sessionId, options);
  return options;
}

export async function queryHullPreviewSprites(sessionId: ProjectSessionId, hullIds: string[]): Promise<Record<string, string>> {
  const references = await queryHullReferences({ sessionId, hullIds: [...new Set(hullIds.filter(Boolean))] });
  return hydrateReferenceSprites(sessionId, references.sprites);
}

export async function querySkinPreviewSprites(sessionId: ProjectSessionId, skins: SkinFile[]): Promise<Record<string, string>> {
  const references = await queryHullReferences({
    sessionId,
    hullIds: skins.map((skin) => skin.skinHullId),
  });
  return hydrateReferenceSprites(sessionId, references.sprites);
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function hydrateReferenceSprites(sessionId: ProjectSessionId, sprites: Record<string, ResourceRef>): Promise<Record<string, string>> {
  const owners = Object.keys(sprites);
  const resources = owners.map((owner) => sprites[owner]).filter(Boolean);
  if (resources.length === 0) return {};
  const dataUrls = await queryResourceDataUrlBatch(sessionId, resources);
  return Object.fromEntries(dataUrls.map((dataUrl, index) => [owners[index], dataUrl]));
}

async function hydrateSelectOptionSprites(sessionId: ProjectSessionId, options: SelectOption[]) {
  const leafOptions = options.flatMap((option) => option.children ?? [option]).filter((option) => option.resourceRef);
  const resources = leafOptions.map((option) => option.resourceRef as ResourceRef);
  if (resources.length === 0) return;
  const dataUrls = await queryResourceDataUrlBatch(sessionId, resources);
  dataUrls.forEach((dataUrl, index) => {
    leafOptions[index].sprite = dataUrl;
  });
}

function hullOptionToSelectOption(option: HullReferenceOption): SelectOption {
  return {
    label: option.label,
    value: option.value,
    sprite: option.sprite ?? '',
    resourceRef: option.resourceRef ?? null,
  };
}

export interface MissionEntity {
  id: string;
  list: RowData;
  descriptor: RowData;
  text: string;
  iconResourceRef?: ResourceRef | null;
  relPath?: string;
}

function missionEntityFromQuery(entity: EntityData): MissionEntity {
  const data = entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data) ? (entity.data as RowData) : {};
  return {
    id: entity.id,
    list: objectField(data.list),
    descriptor: objectField(data.descriptor),
    text: typeof data.text === 'string' ? data.text : '',
    iconResourceRef: resourceRefField(data.iconResourceRef),
    relPath: typeof data.relPath === 'string' ? data.relPath : undefined,
  };
}

function objectField(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}

function resourceRefField(value: unknown): ResourceRef | null {
  const data = objectField(value);
  return typeof data.source === 'string' && typeof data.relPath === 'string' ? (data as unknown as ResourceRef) : null;
}
