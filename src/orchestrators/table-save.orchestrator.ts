import type { AssociatedFileChange, CsvRowPatch } from '@/shared/types';
import type { ProjectManifest, TableKey } from '@/shared/types';
import type { ModTableState } from '@/shared/types/workspace.types';
import { invalidateWriteResultForMod, recordFileSave } from '@/orchestrators/file-save.orchestrator';
import { getAssociatedFileCandidates, isAssociatedFileForTable } from '@/domain/tables/associated-file-candidates';
import { isCsvDeletedRow } from '@/domain/tables/csv-dirty';
import { saveTablePatch } from '@/services/csv-table.service';
import { useTablesStore } from '@/stores/tables.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { resolveTableRowKey, TABLE_ROW_KEY_FIELD } from '@/domain/tables/table-row-key';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';

export type TableSaveResult = 'saved' | 'noop';

export function selectActiveTableAssociatedFileCandidates() {
  const tables = useTablesStore();
  return getAssociatedFileCandidates(tables.getActiveModTableState(), tables.currentTab, resolveTableRowKey);
}

export async function saveActiveTableChanges(
  manifest: ProjectManifest | null,
  associatedFiles: AssociatedFileChange[],
): Promise<TableSaveResult> {
  const tables = useTablesStore();
  const capturedModRoot = tables.activeModRoot;
  const state = tables.getActiveModTableState();
  if (!manifest || !capturedModRoot || !state || tables.saving || manifest.modRoot !== capturedModRoot) return 'noop';

  tables.setSaving(true);
  try {
    tables.finishCellEdit();
    const table = tables.currentTab;
    if (Object.keys(state.dirty[table]).length === 0) return 'noop';

    const csvEditHistory = useTablesEditHistoryStore();
    const tableAssociatedFiles = associatedFiles.filter((file) => isAssociatedFileForTable(table, file.relPath));
    const patches = buildCurrentTablePatches(state, table);
    const result = await saveTablePatch(manifest.sessionId, table, patches, tableAssociatedFiles);
    tables.applySavedRowKeyMap(table, result.keyMap);
    tables.markTableSaved(table);

    if (result.changes.length > 0) {
      csvEditHistory.clearCsvEditHistory(capturedModRoot, table);
      recordFileSave(capturedModRoot, result, `保存 ${table} CSV`);
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
    if (isCsvDeletedRow(changes)) return { rowKey, action: 'delete', row: {} };
    const row = state.tables[table].find(
      (candidate, index) => isLoadedCsvTableRow(candidate) && resolveTableRowKey(table, candidate, index) === rowKey,
    );
    const cleanRow = { ...(row ?? {}) };
    delete cleanRow[TABLE_ROW_KEY_FIELD];
    return { rowKey, action: 'upsert', row: cleanRow };
  });
}
