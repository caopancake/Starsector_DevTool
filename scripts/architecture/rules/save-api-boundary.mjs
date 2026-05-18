import { classifyFrontendPath } from '../shared/classify.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const saveApiBoundaryRule = {
  name: 'save-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const importsSaveApi = importedProjectPaths(file).some(
        (imported) =>
          !imported.typeOnly &&
          imported.resolved.startsWith('src/shared/api/') &&
          /(?:save|create|delete|upload|apply)/i.test(imported.specifier),
      );
      if (importsSaveApi && !canUseSaveApi(file.rel)) {
        failures.push(`${file.rel}: save-capable APIs belong in shared/api, feature services, or orchestrators`);
      }
    }
    return failures;
  },
};

function canUseSaveApi(rel) {
  const owner = classifyFrontendPath(rel);
  return rel.startsWith('src/shared/api/') || owner.layer === 'services' || owner.layer === 'orchestrators';
}
