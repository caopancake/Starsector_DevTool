import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const editorModuleBoundaryRule = {
  name: 'editor-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel) || !isEditorComponent(file.rel)) continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (/^src\/shared\/api\//.test(imported.resolved)) {
          failures.push(`${file.rel}: editor components must not call wire APIs`);
        }
        if (/^src\/services\/(?:query|write|resource-cache|editor|csv-table)\.service(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: editor components must use editor ViewModel output instead of services`);
        }
        if (/^src\/orchestrators\/(?:editor-save|file-save|file-history-replay)\.orchestrator(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: editor components must not own save or history orchestration`);
        }
      }
      if (/\bqueryCsvTableWindow\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: editor candidates must use source/entity query, not CSV windows`);
      }
    }
    return failures;
  },
};

function isEditorComponent(path) {
  return /^src\/app\/components\/editors\//.test(path) || /^src\/app\/EditorWindow/.test(path);
}
