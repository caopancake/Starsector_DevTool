import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const configModuleBoundaryRule = {
  name: 'config-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (current.layer !== 'app' || current.role !== 'component' || current.domain !== 'config') continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (target.role === 'api') {
          failures.push(`${file.rel}: config components must not call wire APIs`);
        }
        if (target.role === 'service') {
          failures.push(`${file.rel}: config components must use ViewModel state and actions instead of services`);
        }
        if (target.role === 'orchestrator') {
          failures.push(`${file.rel}: config components must not own save or history orchestration`);
        }
      }
      if (/\bResourceRef\b/.test(file.text) && !/\btype\s+ResourceRef\b/.test(file.text)) {
        failures.push(`${file.rel}: config components must consume resolved preview state, not ResourceRef details`);
      }
      if (/\bEntityData\b/.test(file.text) && !/\btype\s+EntityData\b/.test(file.text)) {
        failures.push(`${file.rel}: config components must consume ViewModel page data, not raw entity query data`);
      }
    }
    return failures;
  },
};
