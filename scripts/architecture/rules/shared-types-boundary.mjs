export const sharedTypesBoundaryRule = {
  name: 'shared-types-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (file.rel.startsWith('src/shared/types/') && /from\s+['"]@\/shared\/types(?:\/index)?['"]/.test(file.text)) {
        failures.push(`${file.rel}: shared type ownership files must import concrete type files, not the shared types barrel`);
      }
    }
    return failures;
  },
};
