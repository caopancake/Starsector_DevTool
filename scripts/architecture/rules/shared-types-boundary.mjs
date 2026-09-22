export const sharedTypesBoundaryRule = {
  name: 'shared-types-boundary',
  /** @param {import('../../shared/files.mjs').RepoFile[]} files @returns {string[]} */
  check(files) {
    const failures = [];
    for (const file of files) {
      if (file.rel.startsWith('src/shared/types/') && /from\s+['"]@\/shared\/types(?:\/index)?['"]/.test(file.text)) {
        failures.push(`${file.rel}: shared type ownership files must import concrete type files, not the shared types barrel`);
      }
      if (!file.rel.startsWith('src/shared/types/') && /from\s+['"]@\/shared\/types\/[a-z-]+(?:\.types)?['"]/.test(file.text)) {
        failures.push(`${file.rel}: shared types must be imported through the unified barrel, not member files`);
      }
    }
    return failures;
  },
};
