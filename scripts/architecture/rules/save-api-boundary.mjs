import { importedProjectPaths } from '../shared/imports.mjs';
import { isSharedApiBoundary } from '../shared/rule-helpers.mjs';

export const saveApiBoundaryRule = {
  name: 'save-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const importsSharedApi = importedProjectPaths(file).some(
        (imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'),
      );
      if (importsSharedApi && !isSharedApiBoundary(file.rel)) {
        failures.push(`${file.rel}: shared/api imports belong in shared/api, services, or orchestrators`);
      }
    }
    return failures;
  },
};
