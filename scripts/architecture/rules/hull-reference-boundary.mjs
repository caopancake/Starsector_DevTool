import { frontendFile, singleFileByRel } from '../shared/files.mjs';

export const hullReferenceBoundaryRule = {
  name: 'hull-reference-boundary',
  check(files) {
    const failures = [];
    const hullReferences = singleFileByRel(files, 'src/shared/lib/hull-references.ts');
    const hullReferenceOwner = hullReferences ? hullReferenceModuleSignature(hullReferences.text) : null;
    for (const { rel, text } of files) {
      if (frontendFile(rel) && hullReferenceModuleSignature(text) !== hullReferenceOwner && /\.shipSprites\s*\[/.test(text)) {
        failures.push(`${rel}: direct shipSprites indexing is not allowed; use hull-references helpers for hull references`);
      }
    }
    return failures;
  },
};

function hullReferenceModuleSignature(text) {
  return /export\s+function\s+resolveHullReference/.test(text) && text.includes('shipSprites') ? 'hull-reference-module' : null;
}
