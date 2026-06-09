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
    }
    return failures;
  },
};
