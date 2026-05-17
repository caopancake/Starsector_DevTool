export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function normalizeRelPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function pathBasename(path: string): string {
  return normalizeRelPath(path).split('/').filter(Boolean).pop() || path;
}

export function pathStem(path: string): string {
  return pathBasename(path).replace(/\.[^.]+$/, '');
}

export function relativePathFromRoot(root: string, path: string): string {
  return normalizeFsPath(path).slice(normalizeFsPath(root).length + 1);
}
