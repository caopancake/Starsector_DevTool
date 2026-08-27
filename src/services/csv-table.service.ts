import { querySessionCsvRowPreview, querySessionSourceOptions, querySessionTableWindow } from '@/services/query.service';
import { queryResourceDataUrls } from '@/services/resource-cache.service';
import { writeCsvPatch } from '@/services/write.service';
import { recordPerformance } from '@/services/performance.service';
import type {
  AssociatedSpecChange,
  CsvFactionFilter,
  CsvRowPatch,
  CsvTableWindow,
  ProjectSessionId,
  SourceOptionGroup,
  TableKey,
  WriteResult,
} from '@/shared/types';

export function queryTableWindow(
  sessionId: ProjectSessionId,
  table: TableKey,
  start: number,
  count: number,
  search: string | null,
  faction: CsvFactionFilter,
): Promise<CsvTableWindow> {
  return querySessionTableWindow(sessionId, table, start, count, search, faction);
}

export async function querySourceOptionCatalog(sessionId: ProjectSessionId, source: string): Promise<SourceOptionGroup[]> {
  const startedAt = performance.now();
  const groups = await querySessionSourceOptions(sessionId, source);
  recordPerformance('frontend.query.sourceCatalog', performance.now() - startedAt, {
    source,
    groups: groups.length,
    options: groups.reduce((sum, group) => sum + group.options.length, 0),
  });
  return groups;
}

export function saveTablePatch(
  sessionId: ProjectSessionId,
  modRoot: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedSpecs: AssociatedSpecChange[],
): Promise<WriteResult> {
  return writeCsvPatch(sessionId, modRoot, table, patches, associatedSpecs);
}

export async function queryTableRowPreviewDataUrl(sessionId: ProjectSessionId, table: TableKey, rowKey: string): Promise<string> {
  const resource = (await querySessionCsvRowPreview(sessionId, table, rowKey)).resourceRef;
  if (!resource) return '';
  return (await queryResourceDataUrls(sessionId, [resource]))[0] ?? '';
}
