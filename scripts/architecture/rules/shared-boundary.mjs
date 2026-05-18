import { importedProjectPaths } from '../shared/imports.mjs';

export const sharedBoundaryRule = {
  name: 'shared-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!file.rel.startsWith('src/shared/')) continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.resolved.startsWith('src/') && !imported.resolved.startsWith('src/shared/')) {
          failures.push(`${file.rel}: shared code must not depend on upper application layers`);
        }
      }
    }
    return failures;
  },
};
