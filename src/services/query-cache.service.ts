import { recordPerformance } from '@/services/performance.service';

const cache = new Map<string, unknown>();

export async function queryCached<T>(
  sessionId: string,
  queryKind: string,
  parameters: Record<string, unknown>,
  loader: () => Promise<T>,
): Promise<T> {
  const key = queryCacheKey(sessionId, queryKind, parameters);
  const startedAt = performance.now();
  if (cache.has(key)) {
    recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: true });
    return cache.get(key) as T;
  }
  const value = await loader();
  cache.set(key, value);
  recordPerformance('frontend.queryCache', performance.now() - startedAt, { queryKind, hit: false });
  return value;
}

export function invalidateQueryCacheForSession(sessionId: string) {
  const prefix = `${sessionId}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateQueryCacheByPaths(sessionId: string) {
  invalidateQueryCacheForSession(sessionId);
}

function queryCacheKey(sessionId: string, queryKind: string, parameters: Record<string, unknown>) {
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
