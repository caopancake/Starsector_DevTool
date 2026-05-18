import { frontendFile } from '../shared/files.mjs';

const allowedInvokeRoot = 'src/shared/api/';

export const frontendApiBoundaryRule = {
  name: 'frontend-api-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (
        frontendFile(rel) &&
        !rel.startsWith(allowedInvokeRoot) &&
        (text.includes('@tauri-apps/api/core') || /\binvoke\s*\(/.test(text))
      ) {
        failures.push(`${rel}: Tauri invoke is only allowed in src/shared/api`);
      }
    }
    return failures;
  },
};
