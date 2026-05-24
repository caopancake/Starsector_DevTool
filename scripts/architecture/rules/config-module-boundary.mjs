import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const configModuleBoundaryRule = {
  name: 'config-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel) || !isConfigComponent(file.rel)) continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (/^src\/shared\/api\//.test(imported.resolved)) {
          failures.push(`${file.rel}: config components must not call wire APIs`);
        }
        if (/^src\/services\/(?:query|write|resource-cache|config-entity|csv-table)\.service(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: config components must use ViewModel state and actions instead of services`);
        }
        if (
          /^src\/orchestrators\/(?:config-save|file-save|table-save|file-history-replay)\.orchestrator(?:\.ts)?$/.test(imported.resolved)
        ) {
          failures.push(`${file.rel}: config components must not own save or history orchestration`);
        }
      }
      if (/\bResourceRef\b/.test(file.text) && !/\btype\s+ResourceRef\b/.test(file.text)) {
        failures.push(`${file.rel}: config components must consume resolved preview state, not ResourceRef details`);
      }
    }
    return failures;
  },
};

function isConfigComponent(path) {
  return /^src\/app\/components\/config\/Config(?:Faction|Mission|Variant|Skin)/.test(path);
}
