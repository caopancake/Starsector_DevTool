import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths, importSpecifiers } from '../shared/imports.mjs';

export const csvModuleBoundaryRule = {
  name: 'csv-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      if (!isCsvGridFile(file.rel)) continue;
      if (/<n-select\b/i.test(file.text)) {
        failures.push(`${file.rel}: CSV Grid must use CsvCellPicker instead of Naive select controls`);
      }
      for (const imported of importSpecifiers(file.text)) {
        if (imported.typeOnly || imported.specifier !== 'naive-ui') continue;
        if (/\bNSelect\b/.test(imported.importedName ?? '')) {
          failures.push(`${file.rel}: CSV Grid must not import Naive select controls`);
        }
      }
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (/^src\/services\/(?:query|resource-cache|write)\.service(?:\.ts)?$/.test(imported.resolved)) {
          failures.push(`${file.rel}: CSV Grid must receive query/write/resource behavior from its ViewModel`);
        }
      }
      if (/\brevertChanges\s*\(|\bsaveAll[A-Za-z0-9_]*Csv|\bsaveCsvTables\b/.test(file.text)) {
        failures.push(`${file.rel}: CSV actions must stay scoped to the active table`);
      }
    }
    return failures;
  },
};

function isCsvGridFile(path) {
  return /^src\/app\/components\/tables\/Csv/.test(path) || /^src\/app\/components\/tables\/DataTable\.vue$/.test(path);
}
