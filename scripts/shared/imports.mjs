import { dirname, join, normalize } from 'node:path';

/** @typedef {{ importedName: string | null, specifier: string, typeOnly: boolean }} ImportSpecifierInfo */
/** @typedef {ImportSpecifierInfo & { resolved: string }} ResolvedImport */

/** @param {string} text @returns {ImportSpecifierInfo[]} */
export function importSpecifiers(text) {
  const specs = [];
  for (const match of text.matchAll(/import\s+(type\s+)?([^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    specs.push({ importedName: null, specifier: match[3], typeOnly: Boolean(match[1]) });
    for (const name of namedImportNames(match[2] ?? '')) {
      specs.push({ importedName: name, specifier: match[3], typeOnly: Boolean(match[1]) || /\btype\s+/.test(match[2] ?? '') });
    }
  }
  for (const match of text.matchAll(/export\s+(type\s+)?([^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    specs.push({ importedName: null, specifier: match[3], typeOnly: Boolean(match[1]) });
    for (const name of namedImportNames(match[2] ?? '')) {
      specs.push({ importedName: name, specifier: match[3], typeOnly: Boolean(match[1]) || /\btype\s+/.test(match[2] ?? '') });
    }
  }
  for (const match of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specs.push({ importedName: null, specifier: match[1], typeOnly: false });
  }
  return specs;
}

/** @param {string} importClause @returns {string[]} */
function namedImportNames(importClause) {
  const match = importClause.match(/\{([\s\S]*?)\}/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((part) =>
      part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        ?.trim(),
    )
    .filter(Boolean);
}

/** @param {string} fromRel @param {string} specifier @returns {string} */
export function resolvedProjectImport(fromRel, specifier) {
  if (specifier.startsWith('@/')) return normalizeProjectPath(`src/${specifier.slice(2)}`);
  if (!specifier.startsWith('.')) return specifier;
  return normalizeProjectPath(join(dirname(fromRel), specifier));
}

/** @param {string} path @returns {string} */
export function normalizeProjectPath(path) {
  return normalize(path).replace(/\\/g, '/');
}

/** @param {import('./files.mjs').RepoFile} file @returns {ResolvedImport[]} */
export function importedProjectPaths(file) {
  return importSpecifiers(file.text).map((item) => ({
    ...item,
    resolved: resolvedProjectImport(file.rel, item.specifier),
  }));
}

/** @param {string} text @returns {string[]} */
export function exportedFunctionNames(text) {
  return [
    ...[...text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g)].map((match) => match[1]),
  ];
}
