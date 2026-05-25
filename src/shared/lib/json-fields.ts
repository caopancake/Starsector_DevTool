export function isInternalJsonFieldKey(key: string): boolean {
  return key.startsWith('_');
}
