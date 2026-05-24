import { frontendFile } from '../shared/files.mjs';

export const hullReferenceBoundaryRule = {
  name: 'hull-reference-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!frontendFile(rel)) continue;
      if (rel === 'src/shared/types/index.ts') continue;
      if (/\bshipSprites\b|\bskinFiles\b|\bvariantFiles\b/.test(text)) {
        failures.push(`${rel}: hull references must be resolved through ProjectSession query/resource services`);
      }
    }
    return failures;
  },
};
