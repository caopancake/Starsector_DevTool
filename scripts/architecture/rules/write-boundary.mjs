import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const writeBoundaryRule = {
  name: 'write-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (current.role === 'component' && target.layer === 'services' && target.domain === 'write') {
          failures.push(`${file.rel}: components must not call write service directly`);
        }
        if (current.role === 'component' && target.layer === 'orchestrators' && target.domain === 'config-save') {
          failures.push(`${file.rel}: config components must use ViewModel actions for saves`);
        }
        if (target.role === 'api' && target.domain === 'write') {
          if (!(current.layer === 'services' && current.domain === 'write')) {
            failures.push(`${file.rel}: write API adapters must be consumed only by write service`);
          }
        }
        if (target.layer === 'services' && target.domain === 'write') {
          if (!canImportWriteService(current)) {
            failures.push(`${file.rel}: write service belongs behind write-facing services and file history replay`);
          }
        }
        if (target.layer === 'services' && ['query-cache', 'resource-cache'].includes(target.domain)) {
          if (!canImportCacheInvalidationService(current)) {
            failures.push(`${file.rel}: cache invalidation services must be driven by ProjectSession refresh boundary`);
          }
        }
        if (target.layer === 'services' && target.domain === 'session' && current.layer === 'orchestrators') {
          if (
            current.domain !== 'project-session-refresh' &&
            current.domain !== 'directory-opening' &&
            current.domain !== 'workspace-persistence'
          ) {
            failures.push(`${file.rel}: project session mutation belongs to project session orchestrators`);
          }
        }
      }
      for (const imported of importedProjectPaths(file)) {
        const target = classifyFrontendPath(imported.resolved);
        if (imported.typeOnly && target.role === 'api' && current.layer !== 'shared') {
          failures.push(`${file.rel}: shared/api write types must not be consumed outside API adapters`);
        }
      }
    }
    return failures;
  },
};

function canImportWriteService(current) {
  if (current.layer === 'services') return current.domain !== 'write';
  return current.layer === 'orchestrators' && current.domain === 'file-history-session';
}

function canImportCacheInvalidationService(current) {
  return (
    (current.layer === 'orchestrators' && current.domain === 'project-session-refresh') ||
    (current.layer === 'services' && current.domain === 'session')
  );
}
