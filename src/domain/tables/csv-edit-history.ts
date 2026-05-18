import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { cell, deepClone } from '@/shared/lib/starsector';
import type { CsvEditHistoryEntry } from '@/shared/types/tables-edit-history.types';
import { resolveTableRowKey, TABLE_ROW_KEY_FIELD } from '@/domain/tables/table-row-key';

export function applyCsvEditUndo(entry: CsvEditHistoryEntry, tableState: ModTableState | undefined): boolean {
  const event = entry.event;
  switch (event.type) {
    case 'csv-cell-edit':
      return applyCsvCellValue(tableState, event.tab, event.rowKey, event.col, event.previousValue);
    case 'row-create':
      return removeTableRow(tableState, event.tab, event.rowKey);
    case 'row-delete':
      return insertTableRow(tableState, event.tab, event.rowIndex, event.rowKey, event.row);
  }
}

export function applyCsvEditRedo(entry: CsvEditHistoryEntry, tableState: ModTableState | undefined): boolean {
  const event = entry.event;
  switch (event.type) {
    case 'csv-cell-edit':
      return applyCsvCellValue(tableState, event.tab, event.rowKey, event.col, event.newValue);
    case 'row-create':
      return insertTableRow(tableState, event.tab, event.rowIndex, event.rowKey, event.row);
    case 'row-delete':
      return removeTableRow(tableState, event.tab, event.rowKey);
  }
}

function applyCsvCellValue(tableState: ModTableState | undefined, tab: TableKey, rowKey: string, col: string, value: string): boolean {
  if (!tableState) return false;
  const row = tableState.tables[tab].find((candidate, index) => resolveTableRowKey(tab, candidate, index) === rowKey);
  if (!row) return false;

  row[col] = value;
  const original = tableState.originalTables[tab].find((candidate, index) => resolveTableRowKey(tab, candidate, index) === rowKey);
  const originalValue = cell(original?.[col]);
  if (value !== originalValue) {
    tableState.dirty[tab][rowKey] ||= {};
    tableState.dirty[tab][rowKey][col] = value;
  } else if (tableState.dirty[tab][rowKey]) {
    delete tableState.dirty[tab][rowKey][col];
    if (Object.keys(tableState.dirty[tab][rowKey]).length === 0) delete tableState.dirty[tab][rowKey];
  }
  return true;
}

function insertTableRow(tableState: ModTableState | undefined, tab: TableKey, rowIndex: number, rowKey: string, row: RowData): boolean {
  if (!tableState) return false;
  const rows = tableState.tables[tab];
  if (rows.some((candidate, index) => resolveTableRowKey(tab, candidate, index) === rowKey)) return true;
  const next = deepClone(row);
  next[TABLE_ROW_KEY_FIELD] = rowKey;
  rows.splice(Math.max(0, Math.min(rowIndex, rows.length)), 0, next);
  markRowDirty(tableState, tab, rowKey, next);
  return true;
}

function removeTableRow(tableState: ModTableState | undefined, tab: TableKey, rowKey: string): boolean {
  if (!tableState) return false;
  const index = tableState.tables[tab].findIndex(
    (candidate, candidateIndex) => resolveTableRowKey(tab, candidate, candidateIndex) === rowKey,
  );
  if (index < 0) return false;
  tableState.tables[tab].splice(index, 1);
  const originalExists = tableState.originalTables[tab].some(
    (candidate, candidateIndex) => resolveTableRowKey(tab, candidate, candidateIndex) === rowKey,
  );
  if (originalExists) {
    tableState.dirty[tab][rowKey] = { _deleted: 'true' };
  } else {
    delete tableState.dirty[tab][rowKey];
  }
  return true;
}

function markRowDirty(tableState: ModTableState, tab: TableKey, rowKey: string, row: RowData) {
  const original = tableState.originalTables[tab].find((candidate, index) => resolveTableRowKey(tab, candidate, index) === rowKey);
  delete tableState.dirty[tab][rowKey];
  if (!original) {
    tableState.dirty[tab][rowKey] = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith('_')) tableState.dirty[tab][rowKey][key] = cell(value);
    }
    return;
  }
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('_')) continue;
    const next = cell(value);
    const prev = cell(original[key]);
    if (next !== prev) {
      tableState.dirty[tab][rowKey] ||= {};
      tableState.dirty[tab][rowKey][key] = next;
    }
  }
}
