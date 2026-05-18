import { importedProjectPaths } from '../shared/imports.mjs';

export const componentApiBoundaryRule = {
  name: 'component-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!file.rel.endsWith('.vue')) continue;
      if (importedProjectPaths(file).some((imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'))) {
        failures.push(`${file.rel}: components must call feature services or orchestrators instead of shared/api`);
      }
    }
    return failures;
  },
};
