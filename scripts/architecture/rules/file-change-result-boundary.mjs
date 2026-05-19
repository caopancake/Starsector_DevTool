import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const fileChangeResultBoundaryRule = {
  name: 'file-change-result-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const owner = classifyFrontendPath(file.rel);
      const importsFileChangeType = importedProjectPaths(file).some(
        (imported) => imported.typeOnly && imported.importedName === 'FileChangeRecord',
      );
      if (!importsFileChangeType) continue;
      if (!['app', 'orchestrators', 'services', 'stores', 'windows', 'shared'].includes(owner.layer)) {
        failures.push(`${file.rel}: FileChangeRecord must stay inside service/orchestrator/window/shared boundaries`);
      }
    }
    return failures;
  },
};
