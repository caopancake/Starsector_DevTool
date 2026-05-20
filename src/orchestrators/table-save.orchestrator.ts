import type { AssociatedFileChange } from '@/shared/api/tables-api';
import { normalizeRelPath, pathStem } from '@/shared/lib/paths';
import { deepClone } from '@/shared/lib/starsector';
import type { AppData, RowData, TableKey } from '@/shared/types';
import { recordFileSave } from '@/orchestrators/file-save.orchestrator';
import {
  getAssociatedFileCandidates as collectAssociatedFileCandidates,
  isAssociatedFileForTable,
} from '@/domain/tables/associated-file-candidates';
import { saveTableRows } from '@/services/table.service';
import { useTablesStore } from '@/stores/tables.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { resolveTableRowKey } from '@/domain/tables/table-row-key';

export type TableSaveResult = 'saved' | 'noop';

export function selectActiveTableAssociatedFileCandidates(appData: AppData | null) {
  const tables = useTablesStore();
  return collectAssociatedFileCandidates(tables.getActiveModTableState(), appData, tables.currentTab, resolveTableRowKey);
}

export async function saveActiveTableChanges(
  appData: AppData | null,
  associatedFiles: AssociatedFileChange[] = [],
): Promise<TableSaveResult> {
  const tables = useTablesStore();
  const capturedModRoot = tables.activeModRoot;
  const state = tables.getActiveModTableState();
  if (!appData || !state || tables.saving || appData.modRoot !== capturedModRoot) return 'noop';

  tables.setSaving(true);
  try {
    tables.finishCellEdit();
    const table = tables.currentTab;
    if (Object.keys(state.dirty[table]).length === 0) return 'noop';

    const csvEditHistory = useTablesEditHistoryStore();
    const tableAssociatedFiles = associatedFiles.filter((file) => isAssociatedFileForTable(table, file.relPath));
    const changes = await saveTableRows(capturedModRoot, table, appData.csvHeaders[table], state.tables[table], tableAssociatedFiles);
    assignAppDataTable(appData, table, state.tables[table]);
    applyAssociatedFileCache(appData, tableAssociatedFiles);
    tables.markTableSaved(table);

    if (changes.length > 0) {
      csvEditHistory.clearCsvEditHistory(capturedModRoot, table);
      recordFileSave(capturedModRoot, changes, `保存 ${table} CSV`);
    }
    return 'saved';
  } finally {
    tables.setSaving(false);
  }
}

function assignAppDataTable(appData: AppData, table: TableKey, rows: RowData[]) {
  const next = deepClone(rows);
  if (table === 'ships') appData.ships = next;
  else if (table === 'weapons') appData.weapons = next;
  else if (table === 'wings') appData.wings = next;
  else if (table === 'hullmods') appData.hullmods = next;
  else if (table === 'shipSystems') appData.shipSystems = next;
  else if (table === 'industries') appData.industries = next;
  else if (table === 'skills') appData.skills = next;
  else if (table === 'abilities') appData.abilities = next;
  else if (table === 'commodities') appData.commodities = next;
  else if (table === 'specialItems') appData.specialItems = next;
  else if (table === 'submarkets') appData.submarkets = next;
  else if (table === 'marketConditions') appData.marketConditions = next;
  else if (table === 'simOpponents') appData.simOpponents = next;
  else if (table === 'descriptions') appData.descriptions = next;
}

function applyAssociatedFileCache(appData: AppData, files: AssociatedFileChange[]) {
  for (const file of files) {
    const relPath = normalizeRelPath(file.relPath);
    const id = pathStem(relPath);
    if (!id) continue;
    if (relPath.startsWith('data/hulls/') && relPath.endsWith('.ship')) {
      if (file.afterText === null) delete appData.shipFiles[id];
      else if (file.afterText !== undefined) appData.shipFiles[id] = parseAssociatedJson(file.afterText);
    } else if (relPath.startsWith('data/weapons/') && relPath.endsWith('.wpn')) {
      if (file.afterText === null) delete appData.wpnFiles[id];
      else if (file.afterText !== undefined) appData.wpnFiles[id] = parseAssociatedJson(file.afterText);
    } else if (relPath.startsWith('data/shipsystems/') && relPath.endsWith('.system')) {
      if (file.afterText === null) delete appData.systemFiles[id];
      else if (file.afterText !== undefined) appData.systemFiles[id] = parseAssociatedJson(file.afterText);
    } else if (relPath.startsWith('data/characters/skills/') && relPath.endsWith('.skill')) {
      if (file.afterText === null) delete appData.skillFiles[id];
      else if (file.afterText !== undefined) appData.skillFiles[id] = parseAssociatedJson(file.afterText);
    }
  }
}

function parseAssociatedJson(text: string): RowData {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
  } catch {
    return {};
  }
}
