import type { AssociatedFileChange, CsvRowPatch } from '@/shared/types';
import type { ProjectManifest, TableKey } from '@/shared/types';
import type { ModTableState } from '@/shared/types/workspace.types';
import { recordFileSave, refreshProjectSessionAfterWrite } from '@/orchestrators/file-save.orchestrator';
import { getAssociatedFileCandidates, isAssociatedFileForTable } from '@/domain/tables/associated-file-candidates';
import { isCsvDeletedRow } from '@/domain/tables/csv-dirty';
import { saveTablePatch } from '@/services/csv-table.service';
import { useTablesStore } from '@/stores/tables.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useProjectStore } from '@/stores/project.store';
import { resolveTableRowKey, TABLE_ROW_KEY_FIELD } from '@/domain/tables/table-row-key';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';
import type { AssociatedFileCandidate } from '@/domain/tables/associated-file-candidates';

export type TableSaveResult = 'saved' | 'noop';

export interface CapturedTableSaveTarget {
  associatedFileCandidates: AssociatedFileCandidate[];
  manifest: ProjectManifest;
  modRoot: string;
  state: ModTableState;
  table: TableKey;
}

export function captureActiveTableSaveTarget(manifest: ProjectManifest | null): CapturedTableSaveTarget | null {
  const tables = useTablesStore();
  const modRoot = tables.activeModRoot;
  const state = tables.getActiveModTableState();
  if (!manifest || !modRoot || !state || manifest.modRoot !== modRoot) return null;

  tables.finishCellEdit();
  const table = state.currentTab;
  const associatedFileCandidates = getAssociatedFileCandidates(state, table, resolveTableRowKey);
  return { associatedFileCandidates, manifest, modRoot, state, table };
}

export async function saveCapturedTableChanges(
  target: CapturedTableSaveTarget | null,
  associatedFiles: AssociatedFileChange[],
): Promise<TableSaveResult> {
  const tables = useTablesStore();
  if (!target || tables.saving) return 'noop';
  if (!isCapturedTableSaveTargetCurrent(target)) return 'noop';
  const state = target.state;

  tables.setSaving(true);
  try {
    const { manifest, modRoot, table } = target;
    if (Object.keys(state.dirty[table]).length === 0) return 'noop';

    const csvEditHistory = useTablesEditHistoryStore();
    const tableAssociatedFiles = associatedFiles.filter((file) => isAssociatedFileForTable(table, file.relPath));
    const patches = buildCurrentTablePatches(state, table);
    const result = await saveTablePatch(manifest.sessionId, table, patches, tableAssociatedFiles);
    if (!isCapturedTableSaveTargetCurrent(target)) return 'saved';
    tables.applySavedRowKeyMapForMod(modRoot, table, result.keyMap);
    tables.markTableSavedForMod(modRoot, table);

    if (result.changes.length > 0) {
      csvEditHistory.clearCsvEditHistory(modRoot, table);
      recordFileSave(modRoot, result, `保存 ${table} CSV`, manifest.sessionId);
      await refreshProjectSessionAfterWrite(modRoot, result, manifest.sessionId);
    }
    return 'saved';
  } finally {
    tables.setSaving(false);
  }
}

function isCapturedTableSaveTargetCurrent(target: CapturedTableSaveTarget): boolean {
  const tables = useTablesStore();
  const project = useProjectStore();
  const currentManifest = project.getManifest(target.modRoot);
  return currentManifest?.sessionId === target.manifest.sessionId && tables.getModTableState(target.modRoot) === target.state;
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
