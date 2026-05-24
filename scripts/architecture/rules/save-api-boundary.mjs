import { importedProjectPaths } from '../shared/imports.mjs';
import { isSharedApiBoundary } from '../shared/rule-helpers.mjs';

export const saveApiBoundaryRule = {
  name: 'save-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const importsSharedApi = importedProjectPaths(file).some(
        (imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'),
      );
      if (importsSharedApi && !isSharedApiBoundary(file.rel)) {
        failures.push(`${file.rel}: shared/api imports belong in shared/api, services, or orchestrators`);
      }
      if (!file.rel.startsWith('src/shared/api/') && /\bsave_csv_with_history\b|\bload_csv_table\b/.test(file.text)) {
        failures.push(`${file.rel}: old CSV load/save commands are forbidden; use session query and rowKey patch save`);
      }
      if (file.rel.startsWith('src/shared/api/') && /\bsave_csv_with_history\b|\bload_csv_table\b/.test(file.text)) {
        failures.push(`${file.rel}: shared/api must not expose old CSV full-table commands`);
      }
      if (file.rel.endsWith('.ts') && /\bqueryCsvTableWindow\s*\([^)]*count\s*:\s*10000/s.test(file.text)) {
        failures.push(`${file.rel}: full-table query is forbidden; use source/entity query or CSV window query with a real viewport`);
      }
    }
    return failures;
  },
};
