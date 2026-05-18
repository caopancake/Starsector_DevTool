import { importedProjectPaths } from '../shared/imports.mjs';
import { classifyFrontendPath } from '../shared/classify.mjs';

const allowedLayers = new Map([
  ['app', new Set(['app', 'windows', 'orchestrators', 'services', 'stores', 'domain', 'shared', 'styles'])],
  ['orchestrators', new Set(['orchestrators', 'services', 'stores', 'domain', 'windows', 'shared'])],
  ['services', new Set(['services', 'domain', 'shared'])],
  ['stores', new Set(['stores', 'domain', 'shared'])],
  ['domain', new Set(['domain', 'shared'])],
  ['windows', new Set(['windows', 'domain', 'shared'])],
  ['shared', new Set(['shared'])],
]);

export const featureBoundaryRule = {
  name: 'feature-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const owner = classifyFrontendPath(file.rel);
      const allowed = allowedLayers.get(owner.layer);
      if (!allowed) continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (target.layer !== 'external' && !allowed.has(target.layer)) {
          failures.push(`${file.rel}: ${owner.layer} layer must not depend on ${target.layer} layer`);
        }
      }
    }
    return failures;
  },
};
