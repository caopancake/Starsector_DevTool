import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';
import { isWindowRootComponent } from '../shared/rule-helpers.mjs';

export const userActionBoundaryRule = {
  name: 'user-action-boundary',
  check(files) {
    const failures = [];
    const writeServiceExports = discoverWriteServiceExports(files);
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const owner = classifyFrontendPath(file.rel);
      if (owner.layer === 'orchestrators' || owner.layer === 'services' || isWindowRootComponent(file)) continue;
      const writeServiceImports = importedProjectPaths(file).filter(
        (imported) =>
          !imported.typeOnly &&
          imported.resolved.startsWith('src/services/') &&
          writeServiceExports.has(serviceExportKey(imported.resolved, imported.importedName)) &&
          callsImportedService(file.text, imported.importedName),
      );
      if (writeServiceImports.length > 0) {
        failures.push(`${file.rel}: write user actions must be coordinated through orchestrators, not UI/composable service calls`);
      }
    }
    return failures;
  },
};

function discoverWriteServiceExports(files) {
  const exports = new Set();
  for (const file of files) {
    if (!file.rel.startsWith('src/services/') || !file.rel.endsWith('.service.ts')) continue;
    const writeImports = new Set(
      importedProjectPaths(file)
        .filter(
          (imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/') && isWriteApiName(imported.importedName),
        )
        .map((imported) => imported.importedName),
    );
    for (const serviceExport of exportedServiceFunctions(file.text)) {
      const body = functionBody(file.text, serviceExport);
      if ([...writeImports].some((apiName) => new RegExp(`\\b${apiName}\\s*\\(`).test(body))) {
        exports.add(serviceExportKey(file.rel, serviceExport));
      }
    }
  }
  return exports;
}

function exportedServiceFunctions(text) {
  return [
    ...[...text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g)].map((match) => match[1]),
  ];
}

function functionBody(text, name) {
  const start = text.indexOf(name);
  if (start < 0) return '';
  const nextExport = text.indexOf('\nexport ', start + name.length);
  return nextExport < 0 ? text.slice(start) : text.slice(start, nextExport);
}

function isWriteApiName(name) {
  return typeof name === 'string' && /^(?:save|create|delete|upload|apply|record)/i.test(name);
}

function serviceExportKey(path, name) {
  return `${path.replace(/\.ts$/, '')}:${name}`;
}

function callsImportedService(text, name) {
  return typeof name === 'string' && new RegExp(`\\b${name}\\s*\\(`).test(text);
}
