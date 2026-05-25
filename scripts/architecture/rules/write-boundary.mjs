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
        const target = classifyFrontendPath(imported.resolved);
        if (current.role === 'component' && target.layer === 'services' && target.domain === 'write') {
          failures.push(`${file.rel}: components must not call write service directly`);
        }
        if (current.role === 'component' && target.layer === 'orchestrators' && target.domain === 'config-save') {
          failures.push(`${file.rel}: config components must use ViewModel actions for saves`);
        }
      }
      for (const imported of importedProjectPaths(file)) {
        const target = classifyFrontendPath(imported.resolved);
        if (imported.typeOnly && target.role === 'api' && current.layer !== 'shared') {
          failures.push(`${file.rel}: shared/api write types must not be consumed outside API adapters`);
        }
      }
      if (current.layer !== 'shared' && /\b(?:WithHistory|WithFileHistory|WithUserAction)\b/.test(file.text)) {
        failures.push(`${file.rel}: user action and history effects must not appear in public function names`);
      }
      if (current.layer !== 'shared' && current.layer !== 'stores' && /\bPromise\s*<\s*FileChangeRecord\[\]\s*>/.test(file.text)) {
        failures.push(`${file.rel}: business write results must use WriteResult, not FileChangeRecord[]`);
      }
      if (current.layer === 'services' && /export\s+type\s+\{[^}]*FileChangeRecord[^}]*\}/s.test(file.text)) {
        failures.push(`${file.rel}: services must not re-export FileChangeRecord; history owns that model`);
      }
      if (
        current.role === 'component' &&
        /\b(?:payload|patches|associatedFiles)\s*=/.test(file.text) &&
        /\bsave[A-Za-z0-9_]*\s*\(/.test(file.text)
      ) {
        failures.push(`${file.rel}: components must not assemble save requests`);
      }
      if (
        current.layer === 'services' &&
        /@\/shared\/api\/write-api/.test(file.text) &&
        /export\s+(?:async\s+)?function\s+\w+/.test(file.text) &&
        /\bwrite|save|upload|delete|create/.test(file.text)
      ) {
        if (current.domain !== 'write' && !/\bWriteResult\b/.test(file.text)) {
          failures.push(`${file.rel}: write-facing services must expose WriteResult semantics`);
        }
      }
      if (/\binvalidate(?:Query|Resource|Project)[A-Za-z0-9_]*\s*\([^)]*(?:changes|modRoot|pathBasename)/s.test(file.text)) {
        failures.push(`${file.rel}: cache invalidation must be driven by WriteResult.invalidatedPaths`);
      }
      if (/\binvalidateQueryCacheForWrite\b/.test(file.text)) {
        failures.push(`${file.rel}: query cache write invalidation must be path-scoped, not a generic write hook`);
      }
      if (/\brecord(?:FileSave|SpriteUploadSaved)\s*\([^)]*\bchanges\b/s.test(file.text)) {
        failures.push(`${file.rel}: file history recording must receive WriteResult, not raw changes`);
      }
    }
    return failures;
  },
};
