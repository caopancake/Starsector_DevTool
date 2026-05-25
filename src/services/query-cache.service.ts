import { recordPerformance } from '@/services/performance.service';
import type { ProjectManifest } from '@/shared/types';
import { parseCsvSource } from '@/domain/tables/csv-source-options';
import { normalizedProjectPath, normalizedRelativePathAffects, normalizeFsPath } from '@/shared/lib/paths';
import { isResourceRef } from '@/shared/lib/resource-ref';

export type QueryCacheKind =
  | 'csv-table-window'
  | 'csv-source-options'
  | 'csv-row-preview'
  | 'hull-references'
  | 'entity-detail'
  | 'entity-list'
  | 'resource-data-urls';

interface QueryIdentity {
  queryKind: QueryCacheKind;
  parameters: Record<string, unknown>;
}

interface QueryCacheEntry extends QueryIdentity {
  value: unknown;
}

interface PendingQueryEntry extends QueryIdentity {
  promise: Promise<unknown>;
  version: number;
}

const cache = new Map<string, QueryCacheEntry>();
const pending = new Map<string, PendingQueryEntry>();
const keyVersions = new Map<string, number>();

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
        cache.set(key, { queryKind, parameters, value });
      }
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, { queryKind, parameters, promise: loaded, version });
  const value = await loaded;
  recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: false });
  return value;
}

export function invalidateQueryCacheForSession(sessionId: string) {
  const prefix = `${sessionId}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of pending.keys()) {
    if (key.startsWith(prefix)) {
      bumpKeyVersion(key);
      pending.delete(key);
    }
  }
}

export function invalidateQueryCacheByPaths(manifest: ProjectManifest, changedPaths: string[]) {
  if (changedPaths.length === 0) return;
  const projectPaths = changedPaths.map((path) => normalizedProjectPath(manifest.modRoot, path));
  const affectedTables = new Set(
    Object.entries(manifest.tableSummaries)
      .filter(([, summary]) => summary?.path && projectPaths.some((path) => path.relative === normalizeFsPath(summary.path)))
      .map(([table]) => table),
  );
  const affectedEverything = projectPaths.some((path) => path.external);
  const relativePaths = projectPaths.map((path) => path.relative);
  const prefix = `${manifest.sessionId}|`;
  for (const [key, entry] of cache.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (affectedEverything || shouldInvalidateQuery(entry, affectedTables, relativePaths)) cache.delete(key);
  }
  for (const [key, entry] of pending.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (affectedEverything || shouldInvalidateQuery(entry, affectedTables, relativePaths)) {
      bumpKeyVersion(key);
      pending.delete(key);
    }
  }
}

function bumpKeyVersion(key: string) {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
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
      const parsed = parseCsvSource(source);
      return parsed ? affectedTables.has(parsed.table) : true;
    }
    case 'hull-references':
    case 'entity-detail':
    case 'entity-list':
      return normalizedPaths.length > 0;
  }
}

function queryParameterText(parameters: Record<string, unknown>, key: string): string | null {
  const value = parameters[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function shouldInvalidateResourceQuery(resources: unknown, normalizedPaths: string[]): boolean {
  if (!Array.isArray(resources)) return normalizedPaths.length > 0;
  return resources.some((resource) => {
    if (!isResourceRef(resource)) return true;
    const relPath = normalizeFsPath(resource.relPath);
    return normalizedPaths.some((path) => normalizedRelativePathAffects(path, relPath));
  });
}

function queryCacheKey(sessionId: string, queryKind: QueryCacheKind, parameters: Record<string, unknown>) {
  return `${sessionId}|${queryKind}|${stableStringify(parameters)}`;
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
