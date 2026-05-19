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
import { TABLE_KEYS, useTablesStore } from '@/stores/tables.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { resolveTableRowKey } from '@/domain/tables/table-row-key';

export type TableSaveResult = 'saved' | 'noop';

export function selectActiveTableAssociatedFileCandidates(appData: AppData | null) {
  const tables = useTablesStore();
  return collectAssociatedFileCandidates(tables.getActiveModTableState(), appData, resolveTableRowKey);
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
    if (!tables.hasDirtyChanges) return 'noop';

    const savedChanges = [];
    const savedLabels = [];
    const csvEditHistory = useTablesEditHistoryStore();
    for (const key of TABLE_KEYS) {
      if (Object.keys(state.dirty[key]).length === 0) continue;
      const tableAssociatedFiles = associatedFiles.filter((file) => isAssociatedFileForTable(key, file.relPath));
      const changes = await saveTableRows(capturedModRoot, key, appData.csvHeaders[key], state.tables[key], tableAssociatedFiles);
      assignAppDataTable(appData, key, state.tables[key]);
      applyAssociatedFileCache(appData, tableAssociatedFiles);
      tables.markTableSaved(key);
      if (changes.length > 0) {
        savedChanges.push(...changes);
        savedLabels.push(`${key} CSV`);
        csvEditHistory.clearCsvEditHistory(capturedModRoot, key);
      }
    }

    if (savedChanges.length > 0) {
      recordFileSave(capturedModRoot, savedChanges, `保存 ${savedLabels.join('、')}`);
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
