import { invoke } from '@tauri-apps/api/core';
import type {
  CsvTableWindow,
  EntityData,
  GameOverviewData,
  HullReferencesResult,
  OpenDirectoryResult,
  ProjectManifest,
  ProjectSessionId,
  ResourceDataUrlBatchResult,
  ResourceRef,
  SourceOptionGroup,
  TableKey,
} from '@/shared/types';

export function openProjectSession(modRoot: string, starsectorRoot?: string | null): Promise<ProjectManifest> {
  return invoke('open_project_session', { modRoot, starsectorRoot: starsectorRoot ?? null });
}

export function closeProjectSession(sessionId: ProjectSessionId): Promise<void> {
  return invoke('close_project_session', { sessionId });
}

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

export function invalidateProjectSession(sessionId: ProjectSessionId, changedPaths: string[]): Promise<void> {
  return invoke('invalidate_project_session', { payload: { sessionId, changedPaths } });
}

export function invalidateCoreCache(starsectorRoot: string): Promise<void> {
  return invoke('invalidate_core_cache', { payload: { starsectorRoot } });
}

export function detectDirectory(path: string, fallbackStarsectorRoot?: string | null): Promise<OpenDirectoryResult> {
  return invoke('detect_directory', { path, fallbackStarsectorRoot: fallbackStarsectorRoot ?? null });
}

export function scanGameOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return invoke('scan_game_overview', { starsectorRoot });
}
