import { singleFileByRel } from '../shared/files.mjs';

export const sharedTypesBoundaryRule = {
  name: 'shared-types-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (
        file.rel.startsWith('src/shared/types/') &&
        !file.rel.endsWith('/index.ts') &&
        /from\s+['"]@\/shared\/types(?:\/index)?['"]/.test(file.text)
      ) {
        failures.push(`${file.rel}: shared type ownership files must import concrete type files, not the shared types barrel`);
      }
    }
    const sharedTypesIndex = singleFileByRel(files, 'src/shared/types/index.ts');
    if (sharedTypesIndex && /\bexport\s+(?:interface|type)\s+[A-Za-z0-9_]+/.test(sharedTypesIndex.text)) {
      failures.push(`${sharedTypesIndex.rel}: shared types index must only re-export type ownership files`);
    }
    return failures;
  },
};
