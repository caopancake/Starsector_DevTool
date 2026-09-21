/**
 * 运行时缓存原语：插入序 LRU 容量淘汰、key 版本计数、pending 去重与整体
 * 重置。语义层（失效匹配、批量加载、性能埋点）由各缓存 service 在其上实现。
 * 状态为纯数据并以闭包持有；需要响应式视图的缓存（如媒体投影）自行在
 * service 层处理，本原语保持框架无关。
 */

export interface RuntimeCacheOptions {
  capacity: number;
}

export interface RuntimeCache<TKey extends string, TValue> {
  readonly size: number;
  get(key: TKey): TValue | undefined;
  peek(key: TKey): TValue | undefined;
  has(key: TKey): boolean;
  set(key: TKey, value: TValue): void;
  touch(key: TKey): void;
  delete(key: TKey): void;
  keys(): IterableIterator<TKey>;
  versionOf(key: TKey): number;
  bumpVersion(key: TKey): void;
  deleteVersion(key: TKey): void;
  hasPending(key: TKey): boolean;
  getPending<TPending = unknown>(key: TKey): TPending | undefined;
  setPending<TPending>(key: TKey, pending: TPending): void;
  deletePending(key: TKey): void;
  reset(): void;
}

export function createRuntimeCache<TKey extends string, TValue>(options: RuntimeCacheOptions): RuntimeCache<TKey, TValue> {
  const { capacity } = options;
  const cache = new Map<TKey, TValue>();
  const versions = new Map<TKey, number>();
  const pending = new Map<TKey, unknown>();

  function touchKey(key: TKey): void {
    const value = cache.get(key);
    if (value === undefined) return;
    cache.delete(key);
    cache.set(key, value);
  }

  function evictOverCapacity(): void {
    while (cache.size > capacity) {
      const oldest = cache.keys().next().value as TKey | undefined;
      if (oldest === undefined) return;
      cache.delete(oldest);
      versions.delete(oldest);
    }
  }

  return {
    get size() {
      return cache.size;
    },
    get(key) {
      const value = cache.get(key);
      if (value === undefined) return undefined;
      touchKey(key);
      return value;
    },
    peek(key) {
      return cache.get(key);
    },
    has(key) {
      return cache.has(key);
    },
    set(key, value) {
      cache.set(key, value);
      evictOverCapacity();
    },
    touch(key) {
      touchKey(key);
    },
    delete(key) {
      cache.delete(key);
      versions.delete(key);
    },
    keys() {
      return cache.keys();
    },
    versionOf(key) {
      return versions.get(key) ?? 0;
    },
    bumpVersion(key) {
      versions.set(key, (versions.get(key) ?? 0) + 1);
    },
    deleteVersion(key) {
      versions.delete(key);
    },
    hasPending(key) {
      return pending.has(key);
    },
    getPending<TPending>(key: TKey) {
      return pending.get(key) as TPending | undefined;
    },
    setPending<TPending>(key: TKey, value: TPending) {
      pending.set(key, value);
    },
    deletePending(key: TKey) {
      pending.delete(key);
    },
    reset() {
      cache.clear();
      versions.clear();
      pending.clear();
    },
  };
}
