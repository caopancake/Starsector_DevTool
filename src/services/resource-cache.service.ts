import { queryResourceDataUrlBatch } from '@/shared/api/query-api';
import { queryCached } from '@/services/query-cache.service';
import { normalizedProjectPath, normalizedRelativePathAffects, normalizeFsPath } from '@/shared/lib/paths';
import { AppError } from '@/shared/lib/errors';
import { sameResourceRef } from '@/shared/lib/resource-ref';
import type { ProjectSessionId, ResourceDataUrlBatchEntry, ResourceRef } from '@/shared/types';

interface CachedResourceDataUrl {
  dataUrl: string | null;
  relPath: string;
  sessionId: ProjectSessionId;
  source: ResourceRef['source'];
}

const cache = new Map<string, CachedResourceDataUrl>();

export async function queryResourceDataUrls(sessionId: ProjectSessionId, resources: ResourceRef[]): Promise<(string | null)[]> {
  const keys = resources.map((resource) => resourceCacheKey(sessionId, resource));
  const missing = new Map<string, ResourceRef>();
  resources.forEach((resource, index) => {
    if (!cache.has(keys[index])) missing.set(keys[index], resource);
  });
  if (missing.size > 0) {
    const request = [...missing.values()];
    const result = await queryCached(sessionId, 'resource-data-urls', { resources: request }, () =>
      queryResourceDataUrlBatch(sessionId, request),
    );
    cacheResourceBatchResult(sessionId, request, result.entries);
  }
  return keys.map((key) => cache.get(key)?.dataUrl ?? null);
}

export function invalidateResourceCacheForSession(sessionId: ProjectSessionId) {
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId === sessionId) cache.delete(key);
  }
}

export function invalidateResourceCacheByPaths(sessionId: ProjectSessionId, projectRoot: string, changedPaths: string[]) {
  if (changedPaths.length === 0) return;
  const projectPaths = changedPaths.map((path) => normalizedProjectPath(projectRoot, path));
  for (const [key, entry] of cache.entries()) {
    if (entry.sessionId !== sessionId) continue;
    if (
      entry.source === 'mod' &&
      projectPaths.some((path) => !path.external && normalizedRelativePathAffects(path.relative, entry.relPath))
    )
      cache.delete(key);
  }
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

function cacheResourceBatchResult(sessionId: ProjectSessionId, request: ResourceRef[], entries: ResourceDataUrlBatchEntry[]): void {
  if (entries.length !== request.length) {
    throw new AppError('资源批量查询返回数量和请求数量不一致', { action: 'query-resource-data-urls' });
  }
  entries.forEach((entry, index) => {
    const resource = request[index];
    ensureBatchEntryMatchesResource(entry, resource);
    cache.set(resourceCacheKey(sessionId, resource), {
      dataUrl: entry.dataUrl,
      relPath: normalizeFsPath(resource.relPath),
      sessionId,
      source: resource.source,
    });
  });
}

function ensureBatchEntryMatchesResource(entry: ResourceDataUrlBatchEntry, resource: ResourceRef): void {
  if (sameResourceRef(entry, resource)) {
    return;
  }
  throw new AppError('资源批量查询返回项和请求资源不一致', { action: 'query-resource-data-urls' });
}
