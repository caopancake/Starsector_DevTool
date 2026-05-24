import type { AssociatedFileChange, CsvRowPatch } from '@/shared/api/write-api';
import type { ProjectManifest, TableKey } from '@/shared/types';
import type { ModTableState } from '@/shared/types/workspace.types';
import { invalidateWriteResultForMod, recordFileSave } from '@/orchestrators/file-save.orchestrator';
import {
  getAssociatedFileCandidates as collectAssociatedFileCandidates,
  isAssociatedFileForTable,
} from '@/domain/tables/associated-file-candidates';
import { saveTablePatch } from '@/services/csv-table.service';
import { useTablesStore } from '@/stores/tables.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { resolveTableRowKey, TABLE_ROW_KEY_FIELD } from '@/domain/tables/table-row-key';

export type TableSaveResult = 'saved' | 'noop';

export function selectActiveTableAssociatedFileCandidates() {
  const tables = useTablesStore();
  return collectAssociatedFileCandidates(tables.getActiveModTableState(), tables.currentTab, resolveTableRowKey);
}

export async function saveActiveTableChanges(
  manifest: ProjectManifest | null,
  associatedFiles: AssociatedFileChange[] = [],
): Promise<TableSaveResult> {
  const tables = useTablesStore();
  const capturedModRoot = tables.activeModRoot;
  const state = tables.getActiveModTableState();
  if (!manifest || !state || tables.saving || manifest.modRoot !== capturedModRoot) return 'noop';

  tables.setSaving(true);
  try {
    tables.finishCellEdit();
    const table = tables.currentTab;
    if (Object.keys(state.dirty[table]).length === 0) return 'noop';

    const csvEditHistory = useTablesEditHistoryStore();
    const tableAssociatedFiles = associatedFiles.filter((file) => isAssociatedFileForTable(table, file.relPath));
    const patches = buildCurrentTablePatches(state, table);
    const result = await saveTablePatch(manifest.sessionId, table, patches, tableAssociatedFiles);
    tables.applySavedRowKeyMap(table, result.keyMap ?? []);
    tables.markTableSaved(table);

    if (result.changes.length > 0) {
      csvEditHistory.clearCsvEditHistory(capturedModRoot, table);
      recordFileSave(capturedModRoot, result.changes, `保存 ${table} CSV`);
      await invalidateWriteResultForMod(capturedModRoot, result);
    }
    return 'saved';
  } finally {
    tables.setSaving(false);
  }
}

function buildCurrentTablePatches(state: ModTableState, table: TableKey): CsvRowPatch[] {
  const dirty = state.dirty[table] ?? {};
  return Object.entries(dirty).map(([rowKey, changes]) => {
    if (changes._deleted === 'true') return { rowKey, action: 'delete', row: {} };
    const row = state.tables[table].find((candidate, index) => resolveTableRowKey(table, candidate, index) === rowKey);
    const cleanRow = { ...(row ?? {}) };
    delete cleanRow[TABLE_ROW_KEY_FIELD];
    return { rowKey, action: 'upsert', row: cleanRow };
  });
}
