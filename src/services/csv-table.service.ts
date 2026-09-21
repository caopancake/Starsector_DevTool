import { querySessionCsvRowPreview, querySessionSourceOptions, querySessionTableWindow } from '@/services/query.service';
import { queryResourceDataUrls } from '@/services/resource-cache.service';
import { recordPerformance } from '@/shared/runtime/performance';
import type { CsvFactionFilter, CsvTableWindow, TableKey } from '@/shared/types';

export function queryTableWindow(
  sessionId: string,
  table: TableKey,
  start: number,
  count: number,
  search: string | null,
  faction: CsvFactionFilter,
): Promise<CsvTableWindow> {
  return querySessionTableWindow(sessionId, table, start, count, search, faction);
}

export async function querySourceOptionCatalog(sessionId: string, source: string) {
  const startedAt = performance.now();
  const groups = await querySessionSourceOptions(sessionId, source);
  recordPerformance('frontend.query.sourceCatalog', performance.now() - startedAt, {
    source,
    groups: groups.length,
    options: groups.reduce((sum, group) => sum + group.options.length, 0),
  });
  return groups;
}

export async function queryTableRowPreviewDataUrl(sessionId: string, table: TableKey, rowKey: string): Promise<string> {
  const resource = (await querySessionCsvRowPreview(sessionId, table, rowKey)).resourceRef;
  if (!resource) return '';
  return (await queryResourceDataUrls(sessionId, [resource]))[0] ?? '';
}
