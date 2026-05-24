import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const writeBoundaryRule = {
  name: 'write-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (current.role === 'component' && matchesService(imported.resolved, 'write')) {
          failures.push(`${file.rel}: components must not call write service directly`);
        }
        if (current.role === 'component' && /\/config-save\.orchestrator(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: config components must use ViewModel actions for saves`);
        }
      }
      if (
        current.role === 'component' &&
        /\b(?:payload|patches|associatedFiles)\s*=/.test(file.text) &&
        /\bsave[A-Za-z0-9_]*\s*\(/.test(file.text)
      ) {
        failures.push(`${file.rel}: components must not assemble save payloads`);
      }
      if (
        current.layer === 'services' &&
        /@\/shared\/api\/write-api/.test(file.text) &&
        /export\s+(?:async\s+)?function\s+\w+/.test(file.text) &&
        /\bwrite|save|upload|delete|create/.test(file.text)
      ) {
        if (!matchesService(file.rel, 'write') && !/\bWriteResult\b/.test(file.text)) {
          failures.push(`${file.rel}: write-facing services must expose WriteResult semantics`);
        }
      }
      if (/\binvalidate(?:Query|Resource|Project)[A-Za-z0-9_]*\s*\([^)]*(?:changes|modRoot|pathBasename)/s.test(file.text)) {
        failures.push(`${file.rel}: cache invalidation must be driven by WriteResult.invalidatedPaths`);
      }
    }
    return failures;
  },
};

function matchesService(path, name) {
  return new RegExp(`^src/services/${name}\\.service(?:\\.ts)?$`).test(path);
}
