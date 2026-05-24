import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const windowBoundaryRule = {
  name: 'window-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (current.layer === 'windows' && /^src\/services\/app-config\.service(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: windows must receive settings by payload or events, not read app config`);
        }
      }
      if (current.layer === 'windows' && /\bopenProject\s*\(|\bopenProjectSession\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: child windows must not open ProjectSession`);
      }
      if (current.layer === 'windows' && /\bcreateDefault[A-Za-z0-9_]*Settings\b/.test(file.text)) {
        failures.push(`${file.rel}: window settings context must be received, not recreated`);
      }
    }
    return failures;
  },
};
