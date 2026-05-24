import { querySessionCsvRowPreview, querySessionSourceOptions, querySessionTableWindow } from '@/services/query.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { writeCsvPatch, type AssociatedFileChange, type CsvRowPatch, type WriteResult } from '@/services/write.service';
import { recordPerformance } from '@/services/performance.service';
import type { CsvTableWindow, ProjectSessionId, ResourceRef, RowData, SourceOption, SourceOptionGroup, TableKey } from '@/shared/types';

export function queryTableWindow(
  sessionId: ProjectSessionId,
  table: TableKey,
  start: number,
  count: number,
  search?: string | null,
  faction?: string | null,
): Promise<CsvTableWindow> {
  return querySessionTableWindow(sessionId, table, start, count, search, faction);
}

export async function queryTableSourceOptions(
  sessionId: ProjectSessionId,
  source: string,
  currentValues: string[] = [],
  search?: string | null,
  limit?: number,
): Promise<SourceOptionGroup[]> {
  const startedAt = performance.now();
  const groups = await querySessionSourceOptions(sessionId, source, currentValues, search, limit);
  const resources = groups.flatMap((group) => group.options.map((option) => option.resourceRef).filter(Boolean) as ResourceRef[]);
  const dataUrls = await queryResourceDataUrlBatch(sessionId, resources);
  let resourceIndex = 0;
  const hydrated = groups.map((group) => ({
    ...group,
    options: group.options.map((option) => hydrateSourceOption(option, option.resourceRef ? dataUrls[resourceIndex++] : '')),
  }));
  recordPerformance('frontend.query.sourceOptions', performance.now() - startedAt, {
    source,
    groups: hydrated.length,
    options: hydrated.reduce((sum, group) => sum + group.options.length, 0),
    resources: resources.length,
  });
  return hydrated;
}

export function saveTablePatch(
  sessionId: ProjectSessionId,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<WriteResult> {
  return writeCsvPatch(sessionId, table, patches, associatedFiles);
}

export async function queryTableRowPreviewDataUrl(sessionId: ProjectSessionId, table: TableKey, row: RowData): Promise<string> {
  const rowKey = typeof row._rowKey === 'string' ? row._rowKey : '';
  const resource = rowKey ? (await querySessionCsvRowPreview(sessionId, table, rowKey)).resourceRef : null;
  if (!resource) return '';
  return (await queryResourceDataUrlBatch(sessionId, [resource]))[0] ?? '';
}

function hydrateSourceOption(option: SourceOption, dataUrl: string): SourceOption {
  return dataUrl ? { ...option, sprite: dataUrl } : option;
}
