import { invoke } from '@tauri-apps/api/core';
import type {
  CsvTableWindow,
  CsvRowPreview,
  DiscoveredField,
  EntityData,
  HullReferencesResult,
  ProjectSessionId,
  ResourceDataUrlBatchResult,
  ResourceRef,
  SourceOptionGroup,
  TableKey,
} from '@/shared/types';

export function queryCsvTableWindow(payload: {
  sessionId: ProjectSessionId;
  table: TableKey;
  start: number;
  count: number;
  search?: string | null;
  faction?: string | null;
}): Promise<CsvTableWindow> {
  return invoke('query_csv_table_window', { payload });
}

export function queryCsvSourceOptions(payload: {
  sessionId: ProjectSessionId;
  source: string;
  search?: string | null;
  limit?: number | null;
  currentValues: string[];
}): Promise<SourceOptionGroup[]> {
  return invoke('query_csv_source_options', { payload });
}

export function queryCsvRowPreview(payload: { sessionId: ProjectSessionId; table: TableKey; rowKey: string }): Promise<CsvRowPreview> {
  return invoke('query_csv_row_preview', { payload });
}

export function queryHullReferences(payload: { sessionId: ProjectSessionId; hullIds: string[] }): Promise<HullReferencesResult> {
  return invoke('query_hull_references', { payload });
}

export function queryEntity(payload: { sessionId: ProjectSessionId; kind: string; id: string }): Promise<EntityData | null> {
  return invoke('query_entity', { payload });
}

export function queryEntityList(payload: { sessionId: ProjectSessionId; kind: string }): Promise<EntityData[]> {
  return invoke('query_entity_list', { payload });
}

export function queryResourceDataUrls(sessionId: ProjectSessionId, resources: ResourceRef[]): Promise<ResourceDataUrlBatchResult> {
  return invoke('query_resource_data_urls', { payload: { sessionId, resources } });
}

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return invoke('scan_core_fields', { starsectorRoot });
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return invoke('scan_core_graphics', { starsectorRoot });
}
