import { reactive } from 'vue';
import {
  queryResourceDataUrls,
  resourceCacheKey,
  subscribeResourceInvalidations,
  type ResourceCacheInvalidationEvent,
} from '@/services/resource-cache.service';
import { recordPerformance } from '@/services/performance.service';
import type { ProjectSessionId, ResourceRef } from '@/shared/types';

export const RESOURCE_MEDIA_CACHE_CAPACITY = 512;
export const RESOURCE_MEDIA_FLUSH_DELAY_MS = 25;

export interface ResourceMediaBatchResult {
  observed: number;
  requested: number;
  cacheHits: number;
  resolved: number;
  failed: number;
  failedResources: ResourceRef[];
}

interface PendingMedia {
  sessionId: ProjectSessionId;
  resource: ResourceRef;
  done: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  version: number;
}

type ResourceMediaInvalidationListener = (event: ResourceCacheInvalidationEvent) => void;

const media = reactive(new Map<string, string | null>());
const accessOrder = new Map<string, true>();
const pending = new Map<string, PendingMedia>();
const inFlight = new Map<string, PendingMedia>();
const keyVersions = new Map<string, number>();
const invalidationListeners = new Set<ResourceMediaInvalidationListener>();
let flushHandle: number | null = null;

export function resourceMediaDataUrl(
  sessionId: ProjectSessionId | null | undefined,
  resource: ResourceRef | null | undefined,
): string | undefined {
  if (!sessionId || !resource) return undefined;
  const key = resourceCacheKey(sessionId, resource);
  if (!media.has(key)) return undefined;
  touchMedia(key);
  return media.get(key) ?? undefined;
}

export async function ensureResourceMedia(
  sessionId: ProjectSessionId,
  resources: ResourceRef[],
  surface: string,
): Promise<ResourceMediaBatchResult> {
  const startedAt = performance.now();
  const unique = new Map(resources.map((resource) => [resourceCacheKey(sessionId, resource), resource]));
  const waitFor: Promise<void>[] = [];
  let cacheHits = 0;
  let requested = 0;

  for (const [key, resource] of unique) {
    if (media.has(key)) {
      cacheHits += 1;
      touchMedia(key);
      continue;
    }
    const existing = pending.get(key) ?? inFlight.get(key);
    if (existing) {
      waitFor.push(existing.done);
      continue;
    }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const done = new Promise<void>((doneResolve, doneReject) => {
      resolve = doneResolve;
      reject = doneReject;
    });
    pending.set(key, { sessionId, resource, done, resolve, reject, version: keyVersions.get(key) ?? 0 });
    waitFor.push(done);
    requested += 1;
  }

  scheduleFlush();
  let loadError: unknown = null;
  try {
    await Promise.all(waitFor);
  } catch (error) {
    loadError = error;
  }
  const failedResources = [...unique].flatMap(([key, resource]) => (media.get(key) === null ? [resource] : []));
  const resolved = [...unique.keys()].filter((key) => media.has(key) && media.get(key) !== null).length;
  const result = {
    observed: unique.size,
    requested,
    cacheHits,
    resolved,
    failed: failedResources.length,
    failedResources,
  };
  recordPerformance('frontend.media.visibleBatch', performance.now() - startedAt, {
    surface,
    observed: result.observed,
    requested: result.requested,
    cacheHits: result.cacheHits,
    resolved: result.resolved,
    failed: result.failed,
  });
  if (loadError) throw loadError;
  return result;
}

export function subscribeResourceMediaInvalidations(listener: ResourceMediaInvalidationListener): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

function scheduleFlush(): void {
  if (pending.size === 0 || flushHandle !== null) return;
  flushHandle = window.setTimeout(() => {
    flushHandle = null;
    void flushPendingMedia();
  }, RESOURCE_MEDIA_FLUSH_DELAY_MS);
}

async function flushPendingMedia(): Promise<void> {
  const entries = [...pending.entries()];
  for (const [key, item] of entries) {
    pending.delete(key);
    inFlight.set(key, item);
  }
  const sessions = new Map<ProjectSessionId, Array<[string, PendingMedia]>>();
  for (const entry of entries) {
    const group = sessions.get(entry[1].sessionId) ?? [];
    group.push(entry);
    sessions.set(entry[1].sessionId, group);
  }

  await Promise.all(
    [...sessions].map(async ([sessionId, group]) => {
      try {
        const dataUrls = await queryResourceDataUrls(
          sessionId,
          group.map(([, item]) => item.resource),
        );
        group.forEach(([key, item], index) => {
          if ((keyVersions.get(key) ?? 0) === item.version) storeMedia(key, dataUrls[index] ?? null);
          item.resolve();
        });
      } catch (error) {
        group.forEach(([, item]) => item.reject(error));
      } finally {
        group.forEach(([key, item]) => {
          if (inFlight.get(key) === item) inFlight.delete(key);
        });
      }
    }),
  );
  scheduleFlush();
}

function storeMedia(key: string, dataUrl: string | null): void {
  media.set(key, dataUrl);
  touchMedia(key);
  while (accessOrder.size > RESOURCE_MEDIA_CACHE_CAPACITY) {
    const oldestKey = accessOrder.keys().next().value as string | undefined;
    if (oldestKey === undefined) return;
    accessOrder.delete(oldestKey);
    media.delete(oldestKey);
  }
}

function touchMedia(key: string): void {
  accessOrder.delete(key);
  accessOrder.set(key, true);
}

subscribeResourceInvalidations((event) => {
  if (event.scope === 'session') {
    const prefix = JSON.stringify([event.sessionId]).slice(0, -1);
    const keys = new Set([...media.keys(), ...pending.keys(), ...inFlight.keys()]);
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      invalidateMediaKey(key);
    }
  } else {
    for (const resource of event.resources) {
      const key = resourceCacheKey(event.sessionId, resource);
      invalidateMediaKey(key);
    }
  }
  for (const listener of invalidationListeners) listener(event);
});

function invalidateMediaKey(key: string): void {
  const version = (keyVersions.get(key) ?? 0) + 1;
  keyVersions.set(key, version);
  media.delete(key);
  accessOrder.delete(key);
  const queued = pending.get(key);
  if (queued) queued.version = version;
  inFlight.delete(key);
}
