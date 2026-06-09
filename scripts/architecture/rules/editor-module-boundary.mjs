import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const editorModuleBoundaryRule = {
  name: 'editor-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (!isEditorSurface(current)) continue;
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (target.role === 'api') {
          failures.push(`${file.rel}: editor components must not call wire APIs`);
        }
        if (target.role === 'service') {
          failures.push(`${file.rel}: editor components must use editor ViewModel output instead of services`);
        }
        if (target.role === 'orchestrator') {
          failures.push(`${file.rel}: editor components must not own save or history orchestration`);
        }
      }
      if (/\bqueryCsvTableWindow\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: editor candidates must use source/entity query, not CSV windows`);
      }
      if (
        /function\s+queryEditorEntityBundle[\s\S]*?Promise\.all\(\s*\[[\s\S]*?querySessionEntity\(sessionId,\s*['"]ship['"][\s\S]*?querySessionEntity\(sessionId,\s*['"]weapon['"][\s\S]*?querySessionEntity\(sessionId,\s*['"]projectile['"]/m.test(
          file.text,
        )
      ) {
        failures.push(`${file.rel}: editor bundle query must be selected by editor kind, not a full entity fan-out`);
      }
    }
    return failures;
  },
};

function isEditorSurface(current) {
  return current.layer === 'app' && (current.domain === 'editors' || current.domain === 'editor-window');
}
