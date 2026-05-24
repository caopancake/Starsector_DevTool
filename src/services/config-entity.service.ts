import type {
  IndexedConfigEntityKind,
  IndexedConfigEntityPayload,
  IndexedConfigEntityResult,
  SkinEntityPayload,
  SkinEntityResult,
  VariantEntityPayload,
  VariantEntityResult,
  WriteResult,
} from '@/shared/api/write-api';
import { querySessionEntity, querySessionEntityList, querySessionHullReferences } from '@/services/query.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import {
  createIndexedConfigEntity as createIndexedConfigEntityWrite,
  createSkinEntity as createSkinEntityWrite,
  createVariantEntity as createVariantEntityWrite,
  deleteIndexedConfigEntity as deleteIndexedConfigEntityWrite,
  deleteSkinEntity as deleteSkinEntityWrite,
  deleteVariantEntity as deleteVariantEntityWrite,
  writeIndexedConfigEntity,
  writeModFiles,
  writeSkinEntity,
  writeVariantEntity,
  type WriteResultWith,
} from '@/services/write.service';
import { createDefaultSkin, createDefaultVariant } from '@/domain/config/config-entities';
import type { EntityData, ProjectSessionId, ResourceRef, RowData, SkinFile, VariantFile } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-registry';

export type { IndexedConfigEntityKind, IndexedConfigEntityResult, SkinEntityResult, VariantEntityResult };

export async function listFactionEntityRecords(sessionId: ProjectSessionId): Promise<EntityData[]> {
  return querySessionEntityList(sessionId, 'faction');
}

export async function getFactionEntityRecord(sessionId: ProjectSessionId, id: string): Promise<EntityData | null> {
  return querySessionEntity(sessionId, 'faction', id);
}

export async function listMissionEntities(sessionId: ProjectSessionId): Promise<EntityData[]> {
  return querySessionEntityList(sessionId, 'mission');
}

export async function getMissionEntity(sessionId: ProjectSessionId, id: string): Promise<EntityData | null> {
  return querySessionEntity(sessionId, 'mission', id);
}

export async function listVariantEntities(sessionId: ProjectSessionId): Promise<VariantFile[]> {
  return (await querySessionEntityList(sessionId, 'variant')).map((entity) => entity.data as unknown as VariantFile);
}

export async function listSkinEntities(sessionId: ProjectSessionId): Promise<SkinFile[]> {
  return (await querySessionEntityList(sessionId, 'skin')).map((entity) => entity.data as unknown as SkinFile);
}

export async function queryHullReferenceOptions(sessionId: ProjectSessionId, hullIds: string[] = []): Promise<SelectOption[]> {
  const result = await querySessionHullReferences(sessionId, hullIds);
  return result.groups.flatMap((group) =>
    group.options.map((option) => ({
      label: option.label,
      value: option.value,
      sprite: option.sprite ?? undefined,
      resourceRef: option.resourceRef,
    })),
  );
}

export async function queryHullPreviewSprites(sessionId: ProjectSessionId, hullIds: string[]): Promise<Record<string, string>> {
  const result = await querySessionHullReferences(sessionId, hullIds);
  return hydrateResourceMap(sessionId, result.sprites);
}

export async function querySkinPreviewSprites(sessionId: ProjectSessionId, skinIds: string[]): Promise<Record<string, string>> {
  const result = await querySessionHullReferences(sessionId, skinIds);
  return hydrateResourceMap(sessionId, result.sprites);
}

export function saveModInfo(modRoot: string, data: RowData): Promise<WriteResult> {
  return writeModFiles(modRoot, [{ relPath: 'mod_info.json', afterText: JSON.stringify(data, null, 2) }]);
}

export function saveIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  return writeIndexedConfigEntity(payload);
}

export function createIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  return createIndexedConfigEntityWrite(payload);
}

export function deleteIndexedConfigEntity(
  modRoot: string,
  kind: IndexedConfigEntityKind,
  id: string,
  deleteTarget = false,
): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  return deleteIndexedConfigEntityWrite({ modRoot, kind, id, deleteTarget });
}

export function saveVariantEntity(payload: VariantEntityPayload): Promise<WriteResultWith<VariantEntityResult>> {
  return writeVariantEntity(payload);
}

export function createVariantEntity(modRoot: string, hullId: string, variantId: string): Promise<WriteResultWith<VariantEntityResult>> {
  return createVariantEntityWrite({
    modRoot,
    previousId: null,
    previousRelPath: null,
    nextId: variantId,
    data: createDefaultVariant(hullId, variantId),
  });
}

export function deleteVariantEntity(modRoot: string, relPath: string, variantId: string): Promise<WriteResult> {
  return deleteVariantEntityWrite({ modRoot, relPath, variantId });
}

export function saveSkinEntity(payload: SkinEntityPayload): Promise<WriteResultWith<SkinEntityResult>> {
  return writeSkinEntity(payload);
}

export function createSkinEntity(modRoot: string, baseHullId: string, skinHullId: string): Promise<WriteResultWith<SkinEntityResult>> {
  return createSkinEntityWrite({
    modRoot,
    previousId: null,
    previousRelPath: null,
    nextId: skinHullId,
    data: createDefaultSkin(baseHullId, skinHullId),
  });
}

export function deleteSkinEntity(modRoot: string, relPath: string, skinHullId: string): Promise<WriteResult> {
  return deleteSkinEntityWrite({ modRoot, relPath, skinHullId });
}

async function hydrateResourceMap(sessionId: ProjectSessionId, refs: Record<string, ResourceRef>): Promise<Record<string, string>> {
  const entries = Object.entries(refs);
  const dataUrls = await queryResourceDataUrlBatch(
    sessionId,
    entries.map(([, ref]) => ref),
  );
  return Object.fromEntries(entries.map(([id], index) => [id, dataUrls[index] ?? '']));
}
