import { importedProjectPaths } from '../shared/imports.mjs';

const allowedSaveApiPathPatterns = [
  /^src\/shared\/api\/.+-api\.ts$/,
  /^src\/features\/[^/]+\/.*service\.ts$/,
  /^src\/features\/[^/]+\/.*orchestrator\.ts$/,
  /^src\/features\/[^/]+\/composables\/use-[^/]+\.ts$/,
];

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
      if (importsSaveApi && !allowedSaveApiPathPatterns.some((pattern) => pattern.test(file.rel))) {
        failures.push(`${file.rel}: save-capable APIs belong in shared/api, feature services, or orchestrators`);
      }
    }
    return failures;
  },
};
