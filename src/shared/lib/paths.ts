export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function normalizeRelPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isAbsoluteFsPath(path: string): boolean {
  const normalized = normalizeRelPath(path);
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('/');
}

export function pathBasename(path: string): string {
  return normalizeRelPath(path).split('/').filter(Boolean).pop() || path;
}

export function pathStem(path: string): string {
  return pathBasename(path).replace(/\.[^.]+$/, '');
}

export function joinRootRelativePath(root: string, relativePath: string): string {
  const parts = normalizeRelPath(relativePath).split('/').filter(Boolean);
  return [root.replace(/[\\/]+$/, ''), ...parts].join('\\');
}

export function gameModsDirectoryPath(starsectorRoot: string): string {
  return joinRootRelativePath(starsectorRoot, 'mods');
}

export function gameCoreDirectoryPath(starsectorRoot: string): string {
  return joinRootRelativePath(starsectorRoot, 'starsector-core');
}

export function pathBelongsToRoot(path: string, root: string): boolean {
  const normalizedPath = normalizeFsPath(path);
  const normalizedRoot = normalizeFsPath(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function closestRootForPath(roots: Iterable<string>, path: string): string | null {
  const matches = [...roots].filter((root) => pathBelongsToRoot(path, root));
  matches.sort((a, b) => normalizeFsPath(b).length - normalizeFsPath(a).length);
  return matches[0] ?? null;
}

export function relativePathFromRoot(root: string, path: string): string {
  const normalizedPath = normalizeRelPath(path);
  const comparablePath = normalizeFsPath(path);
  const comparableRoot = normalizeFsPath(root);
  if (comparablePath === comparableRoot) return '';
  return normalizedPath.slice(comparableRoot.length + 1);
}

export function normalizedProjectPath(root: string, path: string): { external: boolean; relative: string } {
  const normalizedPath = normalizeFsPath(path);
  if (pathBelongsToRoot(path, root)) {
    return {
      external: false,
      relative: normalizedPath === normalizeFsPath(root) ? '' : normalizeFsPath(relativePathFromRoot(root, path)),
    };
  }
  return { external: isAbsoluteFsPath(path), relative: normalizedPath };
}

export function normalizedRelativePathAffects(changedRelativePath: string, targetRelativePath: string): boolean {
  if (changedRelativePath === '') return true;
  return targetRelativePath === changedRelativePath || targetRelativePath.startsWith(`${changedRelativePath}/`);
}
