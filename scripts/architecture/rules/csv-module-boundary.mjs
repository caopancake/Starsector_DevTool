import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths, importSpecifiers } from '../shared/imports.mjs';

export const csvModuleBoundaryRule = {
  name: 'csv-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (!isCsvGridSurface(file.text, current)) continue;
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
        const target = classifyFrontendPath(imported.resolved);
        if (target.role === 'service') {
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

function isCsvGridSurface(text, current) {
  return current.layer === 'app' && (current.domain === 'tables' || /\bCsvGrid\b/.test(text));
}
