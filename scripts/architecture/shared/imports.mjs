import { dirname, join, normalize } from 'node:path';

export function importSpecifiers(text) {
  const specs = [];
  for (const match of text.matchAll(/import\s+(type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    specs.push({ specifier: match[2], typeOnly: Boolean(match[1]) });
  }
  for (const match of text.matchAll(/export\s+(type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    specs.push({ specifier: match[2], typeOnly: Boolean(match[1]) });
  }
  for (const match of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specs.push({ specifier: match[1], typeOnly: false });
  }
  return specs;
}

export function resolvedProjectImport(fromRel, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  return normalizeProjectPath(join(dirname(fromRel), specifier));
}

export function normalizeProjectPath(path) {
  return normalize(path).replace(/\\/g, '/');
}

export function importedProjectPaths(file) {
  return importSpecifiers(file.text).map((item) => ({
    ...item,
    resolved: resolvedProjectImport(file.rel, item.specifier),
  }));
}
