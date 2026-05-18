import { importedProjectPaths } from '../shared/imports.mjs';

export const storeApiBoundaryRule = {
  name: 'store-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!file.rel.endsWith('-store.ts')) continue;
      if (importedProjectPaths(file).some((imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'))) {
        failures.push(`${file.rel}: stores must not call shared/api directly`);
      }
    }
    return failures;
  },
};
