import {
  queryCsvRowPreview,
  queryCsvSourceOptions,
  queryCsvTableWindow,
  queryEntity,
  queryEntityList,
  queryHullReferences,
} from '@/shared/api/query-api';
import { queryCached } from '@/services/query-cache.service';
import type {
  CsvRowPreview,
  CsvTableWindow,
  EntityData,
  HullReferencesResult,
  ProjectSessionId,
  SourceOptionGroup,
  TableKey,
} from '@/shared/types';

export function querySessionTableWindow(
  sessionId: ProjectSessionId,
  table: TableKey,
  start: number,
  count: number,
  search?: string | null,
  faction?: string | null,
): Promise<CsvTableWindow> {
  return queryCached(sessionId, 'csv-table-window', { table, start, count, search: search ?? null, faction: faction ?? null }, () =>
    queryCsvTableWindow({ sessionId, table, start, count, search: search ?? null, faction: faction ?? null }),
  );
}

export function querySessionSourceOptions(
  sessionId: ProjectSessionId,
  source: string,
  currentValues: string[],
  search?: string | null,
  limit?: number | null,
): Promise<SourceOptionGroup[]> {
  return queryCached(sessionId, 'csv-source-options', { source, currentValues, search: search ?? null, limit: limit ?? null }, () =>
    queryCsvSourceOptions({ sessionId, source, currentValues, search: search ?? null, limit: limit ?? null }),
  );
}

export function querySessionCsvRowPreview(sessionId: ProjectSessionId, table: TableKey, rowKey: string): Promise<CsvRowPreview> {
  return queryCached(sessionId, 'csv-row-preview', { table, rowKey }, () => queryCsvRowPreview({ sessionId, table, rowKey }));
}

export function querySessionHullReferences(sessionId: ProjectSessionId, hullIds: string[]): Promise<HullReferencesResult> {
  return queryCached(sessionId, 'hull-references', { hullIds }, () => queryHullReferences({ sessionId, hullIds }));
}

export function querySessionEntity(sessionId: ProjectSessionId, kind: string, id: string): Promise<EntityData | null> {
  return queryCached(sessionId, 'entity-detail', { kind, id }, () => queryEntity({ sessionId, kind, id }));
}

export function querySessionEntityList(sessionId: ProjectSessionId, kind: string): Promise<EntityData[]> {
  return queryCached(sessionId, 'entity-list', { kind }, () => queryEntityList({ sessionId, kind }));
}
