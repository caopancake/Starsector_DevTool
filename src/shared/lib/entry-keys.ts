const entryUids = new WeakMap<object, number>();
let nextEntryUid = 1;

export function entryUid(item: unknown): number | null {
  if (!item || typeof item !== 'object') return null;
  const existing = entryUids.get(item);
  if (existing !== undefined) return existing;
  const uid = nextEntryUid;
  nextEntryUid += 1;
  entryUids.set(item, uid);
  return uid;
}

export function entryKey(prefix: string, item: unknown, index: number): string {
  const uid = entryUid(item);
  return uid === null ? `${prefix}-pos-${index}` : `${prefix}-uid-${uid}`;
}
