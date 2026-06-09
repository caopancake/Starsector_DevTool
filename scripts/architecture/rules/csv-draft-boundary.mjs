import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';

const draftStateWritePattern =
  /(?:\b(?:state|tableState)\.(?:dirty|originalTables|pendingExternalTableUpdates)\s*\[[^\n;]*\]\s*=|\bdelete\s+(?:state|tableState)\.(?:dirty|originalTables|pendingExternalTableUpdates)\s*\[|\b(?:state|tableState)\.(?:originalTables)\s*\[[^\n;]*\]\.(?:splice|push)\s*\()/;
const legacyStoreDraftTerms = [
  'applyCellValue',
  'markFullRowDirty',
  'ensureDirtyCells',
  'pushCsvEditEvent',
  'csv-cell-edit',
  'row-create',
  'row-delete',
];

export const csvDraftBoundaryRule = {
  name: 'csv-draft-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);

      if (
        current.layer === 'domain' &&
        current.domain === 'tables' &&
        file.rel.endsWith('/csv-edit-history.ts') &&
        draftStateWritePattern.test(file.text)
      ) {
        failures.push(`${file.rel}: CSV edit history must replay through CSV table draft domain, not mutate draft state`);
      }

      if (current.domain === 'tables' && current.role === 'store') {
        if (legacyStoreDraftTerms.some((term) => file.text.includes(term))) {
          failures.push(`${file.rel}: tables store must delegate CSV draft algorithms to csv-table-draft domain`);
        }
        if (draftStateWritePattern.test(removeLifecycleSections(file.text))) {
          failures.push(`${file.rel}: tables store must not mutate CSV draft state outside lifecycle initialization`);
        }
      }

      const inTablesDomain = current.layer === 'domain' && current.domain === 'tables';
      const inTablesStore = current.layer === 'stores' && current.domain === 'tables';
      if (!inTablesDomain && !inTablesStore && draftStateWritePattern.test(file.text)) {
        failures.push(`${file.rel}: CSV draft state mutations must stay in csv-table-draft domain`);
      }
    }
    return failures;
  },
};

function removeLifecycleSections(text) {
  return text
    .replace(/function emptyDirtyState[\s\S]*?function emptyExternalUpdateState/, 'function emptyExternalUpdateState')
    .replace(/function createModTableState[\s\S]*?function applyManifestSummaries/, 'function applyManifestSummaries');
}
