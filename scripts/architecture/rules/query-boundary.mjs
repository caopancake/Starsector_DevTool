import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const queryBoundaryRule = {
  name: 'query-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (current.role === 'component' && target.layer === 'services' && target.domain === 'query') {
          failures.push(`${file.rel}: components must use ViewModel output instead of query service`);
        }
        if (current.role === 'composable' && target.role === 'api') {
          failures.push(`${file.rel}: ViewModel/composable code must not call shared/api`);
        }
      }
      if (current.layer !== 'services' && /\bquerySession[A-Za-z0-9_]*\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: session query functions must be wrapped by services`);
      }
      if (!isCacheService(current) && /\bnew\s+Map\s*<[^>]*(?:Query|Source|Entity|Resource|Grid)/.test(file.text)) {
        failures.push(`${file.rel}: query caches must use query-cache service, not local maps`);
      }
    }
    return failures;
  },
};

function isCacheService(current) {
  return current.layer === 'services' && ['query-cache', 'resource-cache'].includes(current.domain);
}
