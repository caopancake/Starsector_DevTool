import { queryResourceDataUrlBatch } from '@/shared/api/query-api';
import { normalizeFsPath } from '@/shared/lib/paths';
import { AppError } from '@/shared/lib/errors';
import { sameResourceRef } from '@/shared/lib/resource-ref';
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

const cache = new Map<string, CachedResourceDataUrl>();
const pending = new Map<string, PendingResource>();
const keyVersions = new Map<string, number>();
const invalidationListeners = new Set<ResourceCacheInvalidationListener>();

export async function queryResourceDataUrls(sessionId: ProjectSessionId, resources: ResourceRef[]): Promise<(string | null)[]> {
  const keys = resources.map((resource) => resourceCacheKey(sessionId, resource));
  const missing = new Map<string, { key: string; resource: ResourceRef }>();
  const pendingLoads: Promise<void>[] = [];
  resources.forEach((resource, index) => {
    const key = keys[index];
    if (cache.has(key)) return;
    const pendingResource = pending.get(key);
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
  return keys.map((key) => cache.get(key)?.dataUrl ?? null);
}

export function invalidateResourceCacheForSession(sessionId: ProjectSessionId) {
  const invalidated: ResourceRef[] = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId !== sessionId) continue;
    invalidated.push(entry.resource);
    cache.delete(key);
    keyVersions.delete(key);
  }
  for (const [key, entry] of pending.entries()) {
    if (entry.sessionId !== sessionId) continue;
    invalidated.push(entry.resource);
    bumpKeyVersion(key);
    pending.delete(key);
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
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId !== sessionId) continue;
    if (invalidation.resources.some((scope) => scope.source === entry.source && normalizeFsPath(scope.relPath) === entry.relPath)) {
      invalidated.push(entry.resource);
      cache.delete(key);
      keyVersions.delete(key);
    }
  }
  for (const [key, entry] of pending.entries()) {
    if (entry.sessionId !== sessionId) continue;
    if (invalidation.resources.some((scope) => scope.source === entry.source && normalizeFsPath(scope.relPath) === entry.relPath)) {
      invalidated.push(entry.resource);
      bumpKeyVersion(key);
      pending.delete(key);
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

async function loadMissingResources(sessionId: ProjectSessionId, missing: { key: string; resource: ResourceRef }[]): Promise<void> {
  const request = missing.map((entry) => entry.resource);
  const versions = new Map(missing.map((entry) => [entry.key, keyVersions.get(entry.key) ?? 0]));
  const promise = queryResourceDataUrlBatch(sessionId, request)
    .then((result) => cacheResourceBatchResult(sessionId, request, result.entries, versions))
    .finally(() => {
      for (const entry of missing) {
        if (pending.get(entry.key)?.promise === promise) pending.delete(entry.key);
        if (!pending.has(entry.key) && !cache.has(entry.key)) keyVersions.delete(entry.key);
      }
    });
  for (const entry of missing) {
    pending.set(entry.key, {
      promise,
      relPath: normalizeFsPath(entry.resource.relPath),
      resource: entry.resource,
      sessionId,
      source: entry.resource.source,
    });
  }
  await promise;
}

function bumpKeyVersion(key: string) {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
}

function resourceCacheKey(sessionId: ProjectSessionId, resource: ResourceRef): string {
  return JSON.stringify([
    sessionId,
    resource.source,
    normalizeFsPath(resource.relPath),
    resource.ownerKind,
    resource.ownerId,
    resource.key,
  ]);
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
    if ((keyVersions.get(key) ?? 0) !== versions.get(key)) return;
    cache.set(key, {
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
