import { queryCsvSourceOptions, queryCsvTableWindow, queryEntity } from '@/shared/api/project-api';
import { saveCsvPatchWithHistory, type AssociatedFileChange, type CsvRowPatch } from '@/shared/api/tables-api';
import { AppError, withCause } from '@/shared/lib/errors';
import { cell, rowSpecId } from '@/shared/lib/starsector';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import type { CsvTableWindow, ProjectSessionId, ResourceRef, RowData, SourceOptionGroup, TableKey } from '@/shared/types';

export async function queryTableWindow(
  sessionId: ProjectSessionId,
  table: TableKey,
  start: number,
  count: number,
  search?: string | null,
  faction?: string | null,
): Promise<CsvTableWindow> {
  try {
    return await queryCsvTableWindow({ sessionId, table, start, count, search, faction });
  } catch (error) {
    throw withCause(`读取 ${table} CSV 窗口失败`, error, 'query-table-window');
  }
}

export async function saveTablePatch(
  sessionId: ProjectSessionId,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[] = [],
) {
  ensureCsvContext(sessionId, patches, table);
  try {
    return await saveCsvPatchWithHistory(sessionId, table, patches, associatedFiles);
  } catch (error) {
    throw withCause(`保存 ${table} CSV 失败`, error, 'save-table-patch');
  }
}

export async function queryTableSourceOptions(
  sessionId: ProjectSessionId,
  source: string,
  currentValues: string[] = [],
  search?: string | null,
  limit?: number | null,
): Promise<SourceOptionGroup[]> {
  try {
    const groups = await queryCsvSourceOptions({ sessionId, source, currentValues, search, limit });
    await hydrateSourceOptionSprites(sessionId, groups);
    return groups;
  } catch (error) {
    throw withCause(`读取 ${source} 引用选项失败`, error, 'query-table-source-options');
  }
}

export async function queryTableRowPreviewDataUrl(sessionId: ProjectSessionId, table: TableKey, row: RowData): Promise<string> {
  try {
    const resource = await previewResourceRef(sessionId, table, row);
    if (!resource) return '';
    return (await queryResourceDataUrlBatch(sessionId, [resource]))[0] ?? '';
  } catch (error) {
    throw withCause(`读取 ${table} 预览资源失败`, error, 'query-table-row-preview');
  }
}

async function hydrateSourceOptionSprites(sessionId: ProjectSessionId, groups: SourceOptionGroup[]) {
  const options = groups.flatMap((group) => group.options).filter((option) => option.resourceRef);
  const resources = options.map((option) => option.resourceRef as ResourceRef);
  if (resources.length === 0) return;
  const dataUrls = await queryResourceDataUrlBatch(sessionId, resources);
  dataUrls.forEach((dataUrl, index) => {
    options[index].sprite = dataUrl;
  });
}

function ensureCsvContext(sessionId: string, patches: CsvRowPatch[], table: TableKey) {
  if (!sessionId) {
    throw new AppError(`缺少 ${table} 的 mod 根目录`, { action: 'csv-context' });
  }
  if (patches.length === 0) {
    throw new AppError(`${table} CSV 没有可保存的 patch`, { action: 'csv-context' });
  }
}

async function previewResourceRef(sessionId: string, table: TableKey, row: RowData): Promise<ResourceRef | null> {
  const id = rowSpecId(row, table);
  if (!id) return tableRowResourceRef(table, row, '');
  if (table === 'ships') {
    const entity = await queryEntity({ sessionId, kind: 'ship', id });
    const sprite = entityString(entity?.data, 'spriteName');
    return sprite ? resourceRef('mod', sprite, table, id) : null;
  }
  if (table === 'weapons') {
    const entity = await queryEntity({ sessionId, kind: 'weapon', id });
    const sprite = weaponSprite(entity?.data);
    return sprite ? resourceRef('mod', sprite, table, id) : null;
  }
  if (table === 'wings') {
    const variantId = cell(row.variant);
    const variant = variantId ? await queryEntity({ sessionId, kind: 'variant', id: variantId }) : null;
    const hullId = entityString(variant?.data, 'hullId');
    const ship = hullId ? await queryEntity({ sessionId, kind: 'ship', id: hullId }) : null;
    const sprite = entityString(ship?.data, 'spriteName');
    return sprite ? resourceRef('mod', sprite, table, id) : null;
  }
  return tableRowResourceRef(table, row, id);
}

function tableRowResourceRef(table: TableKey, row: RowData, id: string): ResourceRef | null {
  const relPath =
    table === 'hullmods'
      ? cell(row.sprite)
      : table === 'industries'
        ? cell(row.image)
        : ['shipSystems', 'skills', 'abilities', 'commodities', 'specialItems', 'submarkets', 'marketConditions'].includes(table)
          ? cell(row.icon)
          : '';
  return relPath ? resourceRef('mod', relPath, table, id || cell(row.id)) : null;
}

function resourceRef(source: 'mod' | 'core', relPath: string, table: TableKey, id: string): ResourceRef {
  return { source, relPath, ownerKind: table, ownerId: id, key: 'thumbnail' };
}

function entityString(data: unknown, key: string): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function weaponSprite(data: unknown): string {
  return (
    entityString(data, 'turretSprite') ||
    entityString(data, 'hardpointSprite') ||
    entityString(data, 'turretGunSprite') ||
    entityString(data, 'hardpointGunSprite')
  );
}
