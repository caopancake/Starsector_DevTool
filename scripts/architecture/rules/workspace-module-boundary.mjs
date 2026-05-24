import { frontendFile } from '../shared/files.mjs';

export const workspaceModuleBoundaryRule = {
  name: 'workspace-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      if (/\bcloseWorkspace\s*\(|\bconfirmCloseWorkspace\s*\(/.test(file.text)) {
        if (!/\bcloseProject\b|\bcloseProjectSession\b|\breleaseProjectSession\b|\binvalidateProjectSession\b/.test(file.text)) {
          failures.push(`${file.rel}: workspace lifecycle actions must release or invalidate ProjectSession state`);
        }
        if (!/\bclearQueryCache\b|\binvalidateQueryCache\b|\binvalidateQueryCacheForSession\b/.test(file.text)) {
          failures.push(`${file.rel}: workspace lifecycle actions must clear query cache state`);
        }
        if (!/\bclearResourceCache\b|\binvalidateResourceCache\b|\binvalidateResourceCacheForSession\b/.test(file.text)) {
          failures.push(`${file.rel}: workspace lifecycle actions must clear resource cache state`);
        }
      }
    }
    return failures;
  },
};
