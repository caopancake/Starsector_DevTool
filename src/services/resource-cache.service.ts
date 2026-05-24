import { queryResourceDataUrls } from '@/shared/api/project-api';
import type { ProjectSessionId, ResourceRef } from '@/shared/types';

const cache = new Map<string, string>();

export async function queryResourceDataUrlBatch(sessionId: ProjectSessionId, resources: ResourceRef[]): Promise<string[]> {
  const keys = resources.map((resource) => resourceCacheKey(sessionId, resource));
  const missing = new Map<string, ResourceRef>();
  resources.forEach((resource, index) => {
    if (!cache.has(keys[index])) missing.set(keys[index], resource);
  });
  if (missing.size > 0) {
    const request = [...missing.values()];
    const result = await queryResourceDataUrls(sessionId, request);
    result.entries.forEach((entry, index) => {
      cache.set(resourceCacheKey(sessionId, request[index]), entry.dataUrl ?? '');
    });
  }
  return keys.map((key) => cache.get(key) ?? '');
}

export function invalidateResourceCacheForSession(sessionId: ProjectSessionId) {
  const prefix = `${sessionId}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateResourceCacheByPaths(sessionId: ProjectSessionId, changedPaths: string[]) {
  if (changedPaths.length === 0) return;
  const normalizedPaths = changedPaths.map(normalizePath);
  for (const key of cache.keys()) {
    if (!key.startsWith(`${sessionId}|`)) continue;
    const relPath = normalizePath(key.split('|')[2] ?? '');
    if (normalizedPaths.some((path) => path.endsWith(relPath))) cache.delete(key);
  }
}

function resourceCacheKey(sessionId: ProjectSessionId, resource: ResourceRef): string {
  return [sessionId, resource.source, normalizePath(resource.relPath), resource.ownerKind, resource.ownerId, resource.key].join('|');
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
