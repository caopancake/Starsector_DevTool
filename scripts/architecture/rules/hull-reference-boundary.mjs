import { frontendFile } from '../shared/files.mjs';

const allowedDirectShipSpriteIndexFiles = new Set(['src/app/EditorWindowApp.vue', 'src/shared/lib/hull-references.ts']);

export const hullReferenceBoundaryRule = {
  name: 'hull-reference-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (frontendFile(rel) && !allowedDirectShipSpriteIndexFiles.has(rel) && /\.shipSprites\s*\[/.test(text)) {
        failures.push(`${rel}: direct shipSprites indexing is not allowed; use hull-references helpers for hull references`);
      }
    }
    return failures;
  },
};
