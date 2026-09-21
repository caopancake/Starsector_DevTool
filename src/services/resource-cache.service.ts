import { queryResourceDataUrlBatch } from '@/shared/api/query-api';
import { normalizeFsPath } from '@/shared/lib/paths';
import { AppError } from '@/shared/lib/errors';
import { sameResourceRef } from '@/shared/lib/resource-ref';
import { createRuntimeCache } from '@/shared/runtime/cache';
import type { ProjectInvalidation, ProjectSessionId, ResourceDataUrlBatchEntry, ResourceRef } from '@/shared/types';

interface CachedResourceDataUrl {
  dataUrl: string | null;
  relPath: string;
  resource: ResourceRef;
  sessionId: ProjectSessionId;
  source: ResourceRef['source'];
}

interface PendingResource {
  promise: Promise<void>;
  relPath: string;
  resource: ResourceRef;
  sessionId: ProjectSessionId;
  source: ResourceRef['source'];
}

export interface ResourceCacheInvalidationEvent {
  invalidation: ProjectInvalidation | null;
  resources: ResourceRef[];
  sessionId: ProjectSessionId;
  scope: 'resources' | 'session';
}

type ResourceCacheInvalidationListener = (event: ResourceCacheInvalidationEvent) => void;

export const RESOURCE_DATA_URL_CACHE_CAPACITY = 512;

const dataUrlCache = createRuntimeCache<string, CachedResourceDataUrl>({ capacity: RESOURCE_DATA_URL_CACHE_CAPACITY });
const invalidationListeners = new Set<ResourceCacheInvalidationListener>();

export async function queryResourceDataUrls(sessionId: ProjectSessionId, resources: ResourceRef[]): Promise<(string | null)[]> {
  const keys = resources.map((resource) => resourceCacheKey(sessionId, resource));
  const missing = new Map<string, { key: string; resource: ResourceRef }>();
  const pendingLoads: Promise<void>[] = [];
  resources.forEach((resource, index) => {
    const key = keys[index];
    if (dataUrlCache.get(key) !== undefined) return;
    const pendingResource = dataUrlCache.getPending<PendingResource>(key);
    if (pendingResource) {
      pendingLoads.push(pendingResource.promise);
      return;
    }
    missing.set(key, { key, resource });
  });
  if (missing.size > 0) {
    pendingLoads.push(loadMissingResources(sessionId, [...missing.values()]));
  }
  if (pendingLoads.length > 0) await Promise.all(pendingLoads);
  return keys.map((key) => dataUrlCache.peek(key)?.dataUrl ?? null);
}

export function invalidateResourceCacheForSession(sessionId: ProjectSessionId) {
  const invalidated: ResourceRef[] = [];
  for (const key of [...dataUrlCache.keys()]) {
    const entry = dataUrlCache.peek(key);
    if (!entry || entry.sessionId !== sessionId) continue;
    invalidated.push(entry.resource);
    dataUrlCache.delete(key);
  }
  for (const key of [...dataUrlCache.keys()]) {
    const pendingEntry = dataUrlCache.getPending<PendingResource>(key);
    if (!pendingEntry || pendingEntry.sessionId !== sessionId) continue;
    invalidated.push(pendingEntry.resource);
    dataUrlCache.bumpVersion(key);
    dataUrlCache.deletePending(key);
  }
  notifyResourceInvalidated(sessionId, invalidated, 'session', null);
}

export function invalidateResourceCacheByProject(sessionId: ProjectSessionId, invalidation: ProjectInvalidation) {
  if (invalidation.session) {
    invalidateResourceCacheForSession(sessionId);
    return;
  }
  if (invalidation.resources.length === 0) return;
  const invalidated: ResourceRef[] = [];
  for (const key of [...dataUrlCache.keys()]) {
    const entry = dataUrlCache.peek(key);
    if (!entry || entry.sessionId !== sessionId) continue;
    if (invalidation.resources.some((scope) => scope.source === entry.source && normalizeFsPath(scope.relPath) === entry.relPath)) {
      invalidated.push(entry.resource);
      dataUrlCache.delete(key);
    }
  }
  for (const key of [...dataUrlCache.keys()]) {
    const pendingEntry = dataUrlCache.getPending<PendingResource>(key);
    if (!pendingEntry || pendingEntry.sessionId !== sessionId) continue;
    if (
      invalidation.resources.some(
        (scope) => scope.source === pendingEntry.source && normalizeFsPath(scope.relPath) === pendingEntry.relPath,
      )
    ) {
      invalidated.push(pendingEntry.resource);
      dataUrlCache.bumpVersion(key);
      dataUrlCache.deletePending(key);
    }
  }
  notifyResourceInvalidated(sessionId, invalidated, 'resources', invalidation);
}

export function subscribeResourceInvalidations(listener: ResourceCacheInvalidationListener): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export function hasResourceInvalidation(event: ResourceCacheInvalidationEvent, resources: ResourceRef[]): boolean {
  if (resources.length === 0) return false;
  if (event.scope === 'session') return true;
  return event.resources.some((resource) => resources.some((candidate) => sameResourceRef(candidate, resource)));
}

export function resourceCacheKey(sessionId: ProjectSessionId, resource: ResourceRef): string {
  return JSON.stringify([sessionId, resource.source, normalizeFsPath(resource.relPath)]);
}

async function loadMissingResources(sessionId: ProjectSessionId, missing: { key: string; resource: ResourceRef }[]): Promise<void> {
  const request = missing.map((entry) => entry.resource);
  const versions = new Map(missing.map((entry) => [entry.key, dataUrlCache.versionOf(entry.key)]));
  const promise = queryResourceDataUrlBatch(sessionId, request)
    .then((result) => cacheResourceBatchResult(sessionId, request, result.entries, versions))
    .finally(() => {
      for (const entry of missing) {
        if (dataUrlCache.getPending<PendingResource>(entry.key)?.promise === promise) dataUrlCache.deletePending(entry.key);
        if (!dataUrlCache.hasPending(entry.key) && !dataUrlCache.has(entry.key)) dataUrlCache.deleteVersion(entry.key);
      }
    });
  for (const entry of missing) {
    dataUrlCache.setPending(entry.key, {
      promise,
      relPath: normalizeFsPath(entry.resource.relPath),
      resource: entry.resource,
      sessionId,
      source: entry.resource.source,
    });
  }
  await promise;
}

function cacheResourceBatchResult(
  sessionId: ProjectSessionId,
  request: ResourceRef[],
  entries: ResourceDataUrlBatchEntry[],
  versions: Map<string, number>,
): void {
  if (entries.length !== request.length) {
    throw new AppError('资源批量查询返回数量和请求数量不一致', { action: 'query-resource-data-urls' });
  }
  entries.forEach((entry, index) => {
    const resource = request[index];
    ensureResourceEntryMatch(entry, resource);
    const key = resourceCacheKey(sessionId, resource);
    if (dataUrlCache.versionOf(key) !== versions.get(key)) return;
    dataUrlCache.set(key, {
      dataUrl: entry.dataUrl,
      relPath: normalizeFsPath(resource.relPath),
      resource,
      sessionId,
      source: resource.source,
    });
  });
}

function ensureResourceEntryMatch(entry: ResourceDataUrlBatchEntry, resource: ResourceRef): void {
  if (sameResourceRef(entry, resource)) {
    return;
  }
  throw new AppError('资源批量查询返回项和请求资源不一致', { action: 'query-resource-data-urls' });
}

function notifyResourceInvalidated(
  sessionId: ProjectSessionId,
  resources: ResourceRef[],
  scope: ResourceCacheInvalidationEvent['scope'],
  invalidation: ProjectInvalidation | null,
) {
  if (resources.length === 0) return;
  const event: ResourceCacheInvalidationEvent = {
    invalidation,
    resources,
    sessionId,
    scope,
  };
  for (const listener of invalidationListeners) listener(event);
}
