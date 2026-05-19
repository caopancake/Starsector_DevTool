import { frontendFile } from '../shared/files.mjs';
import { importSpecifiers } from '../shared/imports.mjs';
import { isTauriRuntimeBoundary } from '../shared/rule-helpers.mjs';

export const frontendApiBoundaryRule = {
  name: 'frontend-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      for (const imported of importSpecifiers(file.text)) {
        if (imported.typeOnly || !imported.specifier.startsWith('@tauri-apps/')) continue;
        if (!isTauriRuntimeBoundary(file.rel, imported.specifier)) {
          failures.push(`${file.rel}: Tauri packages must be isolated behind shared/api, windows, or app runtime boundaries`);
        }
      }
      if (!file.rel.startsWith('src/shared/api/') && /\binvoke\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: Tauri invoke belongs to shared/api wire adapters`);
      }
    }
    return failures;
  },
};
