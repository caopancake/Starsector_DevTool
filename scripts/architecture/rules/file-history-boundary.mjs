import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const fileHistoryBoundaryRule = {
  name: 'file-history-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const importsFileSaveOrchestrator = importedProjectPaths(file).some(
        (imported) => !imported.typeOnly && imported.resolved === 'src/orchestrators/file-save.orchestrator',
      );
      if (importsFileSaveOrchestrator && classifyFrontendPath(file.rel).layer !== 'orchestrators') {
        failures.push(`${file.rel}: file history recording APIs are only allowed in orchestrators`);
      }
    }
    return failures;
  },
};
