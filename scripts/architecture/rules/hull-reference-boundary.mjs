import { frontendFile } from '../shared/files.mjs';

export const hullReferenceBoundaryRule = {
  name: 'hull-reference-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (frontendFile(rel) && !canIndexShipSprites(rel) && /\.shipSprites\s*\[/.test(text)) {
        failures.push(`${rel}: direct shipSprites indexing is not allowed; use hull-references helpers for hull references`);
      }
    }
    return failures;
  },
};

function canIndexShipSprites(rel) {
  return rel === 'src/shared/lib/hull-references.ts' || /^src\/app\/[A-Za-z0-9]+WindowApp\.vue$/.test(rel);
}
