import { recordPerformance } from '@/services/performance.service';
import type { ProjectManifest, ResourceRef, TableKey } from '@/shared/types';
import { parseCsvSource } from '@/domain/tables/csv-source-options';
import { normalizedProjectPath, normalizedRelativePathAffects, normalizeFsPath } from '@/shared/lib/paths';
import { isResourceRef, sameResourceRef } from '@/shared/lib/resource-ref';

export type QueryCacheKind =
  | 'csv-table-window'
  | 'csv-source-options'
  | 'csv-row-preview'
  | 'hull-references'
  | 'entity-detail'
  | 'entity-list'
  | 'resource-data-urls';

export interface QueryIdentity {
  queryKind: QueryCacheKind;
  parameters: Record<string, unknown>;
}

interface QueryCacheEntry extends QueryIdentity {
  sessionId: string;
  value: unknown;
}

interface PendingQueryEntry extends QueryIdentity {
  promise: Promise<unknown>;
  sessionId: string;
  version: number;
}

export interface QueryCacheInvalidationEvent {
  queries: QueryIdentity[];
  queryKinds: QueryCacheKind[];
  sessionId: string;
  scope: 'paths' | 'session';
}

type QueryCacheInvalidationListener = (event: QueryCacheInvalidationEvent) => void;

const cache = new Map<string, QueryCacheEntry>();
const pending = new Map<string, PendingQueryEntry>();
const keyVersions = new Map<string, number>();
const invalidationListeners = new Set<QueryCacheInvalidationListener>();
const TAG_METADATA_TABLE: TableKey = 'specialItems';
const FACTION_METADATA_DIR = 'data/world/factions';
const SHIP_SPEC_DIR = 'data/hulls';
const SKIN_SPEC_DIR = 'data/hulls/skins';
const VARIANT_SPEC_DIR = 'data/variants';
const WEAPON_SPEC_DIR = 'data/weapons';
const PROJECTILE_SPEC_DIR = 'data/weapons/proj';
const SYSTEM_SPEC_DIR = 'data/shipsystems';
const SKILL_SPEC_DIR = 'data/characters/skills';
const MISSION_DIR = 'data/missions';

export async function queryCached<T>(
  sessionId: string,
  queryKind: QueryCacheKind,
  parameters: Record<string, unknown>,
  loader: () => Promise<T>,
): Promise<T> {
  const key = queryCacheKey(sessionId, queryKind, parameters);
  const startedAt = performance.now();
  const cached = cache.get(key);
  if (cached) {
    recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: true });
    return cached.value as T;
  }
  const pendingQuery = pending.get(key);
  if (pendingQuery) {
    recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: true, pending: true });
    return (await pendingQuery.promise) as T;
  }
  const version = keyVersions.get(key) ?? 0;
  const loaded = loader()
    .then((value) => {
      if ((keyVersions.get(key) ?? 0) === version) {
        cache.set(key, { queryKind, parameters, sessionId, value });
      }
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, { queryKind, parameters, promise: loaded, sessionId, version });
  const value = await loaded;
  recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: false });
  return value;
}

export function invalidateQueryCacheForSession(sessionId: string) {
  const invalidatedQueries: QueryIdentity[] = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId !== sessionId) continue;
    invalidatedQueries.push(queryIdentity(entry));
    cache.delete(key);
  }
  for (const [key, entry] of pending.entries()) {
    if (entry.sessionId !== sessionId) continue;
    invalidatedQueries.push(queryIdentity(entry));
    bumpKeyVersion(key);
    pending.delete(key);
  }
  notifyQueryCacheInvalidated(sessionId, invalidatedQueries, 'session');
}

export function invalidateQueryCacheByPaths(manifest: ProjectManifest, changedPaths: string[]) {
  if (changedPaths.length === 0) return;
  const projectPaths = changedPaths.map((path) => normalizedProjectPath(manifest.modRoot, path)).filter((path) => !path.external);
  if (projectPaths.length === 0) return;
  const affectedTables = new Set(
    Object.entries(manifest.tableSummaries)
      .filter(
        ([, summary]) =>
          summary?.path && projectPaths.some((path) => normalizedRelativePathAffects(path.relative, normalizeFsPath(summary.path))),
      )
      .map(([table]) => table),
  );
  const relativePaths = projectPaths.map((path) => path.relative);
  const invalidatedQueries: QueryIdentity[] = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId !== manifest.sessionId) continue;
    if (shouldInvalidateQuery(entry, affectedTables, relativePaths)) {
      invalidatedQueries.push(queryIdentity(entry));
      cache.delete(key);
    }
  }
  for (const [key, entry] of pending.entries()) {
    if (entry.sessionId !== manifest.sessionId) continue;
    if (shouldInvalidateQuery(entry, affectedTables, relativePaths)) {
      invalidatedQueries.push(queryIdentity(entry));
      bumpKeyVersion(key);
      pending.delete(key);
    }
  }
  notifyQueryCacheInvalidated(manifest.sessionId, invalidatedQueries, 'paths');
}

export function subscribeQueryCacheInvalidation(listener: QueryCacheInvalidationListener): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export function queryCacheInvalidationIncludes(
  event: QueryCacheInvalidationEvent,
  queryKind: QueryCacheKind,
  matches: (parameters: Record<string, unknown>) => boolean = () => true,
): boolean {
  if (event.scope === 'session') return false;
  return event.queries.some((query) => query.queryKind === queryKind && matches(query.parameters));
}

export function queryCacheInvalidationIncludesResourceIdentity(event: QueryCacheInvalidationEvent, resources: ResourceRef[]): boolean {
  if (resources.length === 0) return false;
  if (event.scope === 'session') return false;
  return event.queries.some((query) => {
    if (query.queryKind !== 'resource-data-urls') return false;
    const queryResources = query.parameters.resources;
    if (!Array.isArray(queryResources)) return true;
    return queryResources.some(
      (resource) => !isResourceRef(resource) || resources.some((candidate) => sameResourceRef(candidate, resource)),
    );
  });
}

function bumpKeyVersion(key: string) {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
}

function queryIdentity(query: QueryIdentity): QueryIdentity {
  return {
    parameters: query.parameters,
    queryKind: query.queryKind,
  };
}

function notifyQueryCacheInvalidated(sessionId: string, queries: QueryIdentity[], scope: QueryCacheInvalidationEvent['scope']) {
  if (queries.length === 0) return;
  const event: QueryCacheInvalidationEvent = {
    queries,
    queryKinds: [...new Set(queries.map((query) => query.queryKind))],
    sessionId,
    scope,
  };
  for (const listener of invalidationListeners) listener(event);
}

function shouldInvalidateQuery(entry: QueryIdentity, affectedTables: Set<string>, normalizedPaths: string[]): boolean {
  switch (entry.queryKind) {
    case 'resource-data-urls':
      return shouldInvalidateResourceQuery(entry.parameters.resources, normalizedPaths);
    case 'csv-table-window':
    case 'csv-row-preview': {
      const table = queryParameterText(entry.parameters, 'table');
      return table ? affectedTables.has(table) : true;
    }
    case 'csv-source-options': {
      const source = queryParameterText(entry.parameters, 'source');
      return shouldInvalidateCsvSourceOptions(source, affectedTables, normalizedPaths);
    }
    case 'hull-references':
      return normalizedPaths.some(pathIsShipOrSkinSpecPath);
    case 'entity-detail':
    case 'entity-list': {
      const kind = queryParameterText(entry.parameters, 'kind');
      return shouldInvalidateEntityQuery(kind, affectedTables, normalizedPaths);
    }
  }
}

function shouldInvalidateCsvSourceOptions(source: string | null, affectedTables: Set<string>, normalizedPaths: string[]): boolean {
  const parsed = parseCsvSource(source);
  if (!parsed) return true;
  if (affectedTables.has(parsed.table)) return true;
  if (parsed.column === 'tags') return affectedTables.has(TAG_METADATA_TABLE) || normalizedPaths.some(pathIsFactionMetadataPath);
  if (parsed.column === 'id') return csvSourceOptionResourceRefsDependOnPaths(parsed.table, normalizedPaths);
  return false;
}

function queryParameterText(parameters: Record<string, unknown>, key: string): string | null {
  const value = parameters[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function shouldInvalidateResourceQuery(resources: unknown, normalizedPaths: string[]): boolean {
  if (!Array.isArray(resources)) return normalizedPaths.length > 0;
  return resources.some((resource) => {
    if (!isResourceRef(resource)) return true;
    if (resource.source !== 'mod') return false;
    const relPath = normalizeFsPath(resource.relPath);
    return normalizedPaths.some((path) => normalizedRelativePathAffects(path, relPath));
  });
}

function pathIsFactionMetadataPath(path: string): boolean {
  return path === FACTION_METADATA_DIR || path.startsWith(`${FACTION_METADATA_DIR}/`);
}

function shouldInvalidateEntityQuery(kind: string | null, affectedTables: Set<string>, paths: string[]): boolean {
  switch (kind) {
    case 'ship':
      return paths.some(pathIsShipSpecPath);
    case 'weapon':
      return affectedTables.has('weapons') || paths.some(pathIsWeaponSpecPath);
    case 'projectile':
      return paths.some(pathIsProjectileSpecPath);
    case 'system':
      return paths.some(pathIsSystemSpecPath);
    case 'skill':
      return paths.some(pathIsSkillSpecPath);
    case 'faction':
      return paths.some(pathIsFactionMetadataPath);
    case 'mission':
      return paths.some(pathIsMissionPath);
    case 'variant':
      return paths.some((path) => pathIsVariantSpecPath(path) || pathIsShipOrSkinSpecPath(path));
    case 'skin':
      return paths.some((path) => pathIsSkinSpecPath(path) || pathIsShipSpecPath(path));
    default:
      return true;
  }
}

function csvSourceOptionResourceRefsDependOnPaths(table: TableKey, paths: string[]): boolean {
  switch (table) {
    case 'ships':
      return paths.some(pathIsShipOrSkinSpecPath);
    case 'weapons':
      return paths.some(pathIsWeaponSpecPath);
    case 'wings':
      return paths.some((path) => pathIsVariantSpecPath(path) || pathIsShipOrSkinSpecPath(path));
    default:
      return false;
  }
}

function pathIsShipOrSkinSpecPath(path: string): boolean {
  return pathIsShipSpecPath(path) || pathIsSkinSpecPath(path);
}

function pathIsShipSpecPath(path: string): boolean {
  return pathIsSpecFile(path, SHIP_SPEC_DIR, '.ship');
}

function pathIsSkinSpecPath(path: string): boolean {
  return pathIsSpecFile(path, SKIN_SPEC_DIR, '.skin');
}

function pathIsVariantSpecPath(path: string): boolean {
  return pathIsSpecFile(path, VARIANT_SPEC_DIR, '.variant');
}

function pathIsWeaponSpecPath(path: string): boolean {
  return pathIsSpecFile(path, WEAPON_SPEC_DIR, '.wpn');
}

function pathIsProjectileSpecPath(path: string): boolean {
  return pathIsSpecFile(path, PROJECTILE_SPEC_DIR, '.proj');
}

function pathIsSystemSpecPath(path: string): boolean {
  return pathIsSpecFile(path, SYSTEM_SPEC_DIR, '.system');
}

function pathIsSkillSpecPath(path: string): boolean {
  return pathIsSpecFile(path, SKILL_SPEC_DIR, '.skill');
}

function pathIsMissionPath(path: string): boolean {
  return path === MISSION_DIR || path.startsWith(`${MISSION_DIR}/`);
}

function pathIsSpecFile(path: string, dir: string, extension: string): boolean {
  return normalizedRelativePathAffects(path, dir) || (path.startsWith(`${dir}/`) && path.endsWith(extension));
}

function queryCacheKey(sessionId: string, queryKind: QueryCacheKind, parameters: Record<string, unknown>) {
  return JSON.stringify([sessionId, queryKind, stableStringify(parameters)]);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
