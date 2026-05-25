import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { cell, deepClone } from '@/shared/lib/starsector';
import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';
import type { CsvEditHistoryEntry } from '@/shared/types/tables-edit-history.types';
import { createCsvDeletedRow, createCsvDirtyCells, csvDirtyCells, hasCsvDirtyCells } from '@/domain/tables/csv-dirty';
import { resolveTableRowKey, TABLE_ROW_KEY_FIELD } from '@/domain/tables/table-row-key';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';

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
  const row = tableState.tables[tab].find(
    (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, index) === rowKey,
  );
  if (!row) return false;

  row[col] = value;
  const original = tableState.originalTables[tab].find(
    (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, index) === rowKey,
  );
  const originalValue = cell(original?.[col]);
  if (value !== originalValue) {
    const cells = ensureDirtyCells(tableState, tab, rowKey);
    cells[col] = value;
  } else if (tableState.dirty[tab][rowKey]) {
    const cells = csvDirtyCells(tableState.dirty[tab][rowKey]);
    if (cells) delete cells[col];
    if (!hasCsvDirtyCells(tableState.dirty[tab][rowKey])) delete tableState.dirty[tab][rowKey];
  }
  return true;
}

function insertTableRow(tableState: ModTableState | undefined, tab: TableKey, rowIndex: number, rowKey: string, row: RowData): boolean {
  if (!tableState) return false;
  const rows = tableState.tables[tab];
  if (rows.some((candidate, index) => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, index) === rowKey)) return true;
  const next = deepClone(row);
  next[TABLE_ROW_KEY_FIELD] = rowKey;
  rows.splice(Math.max(0, Math.min(rowIndex, rows.length)), 0, next);
  markRowDirty(tableState, tab, rowKey, next);
  return true;
}

function removeTableRow(tableState: ModTableState | undefined, tab: TableKey, rowKey: string): boolean {
  if (!tableState) return false;
  const index = tableState.tables[tab].findIndex(
    (candidate, candidateIndex) => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, candidateIndex) === rowKey,
  );
  if (index < 0) return false;
  tableState.tables[tab].splice(index, 1);
  const originalExists = tableState.originalTables[tab].some(
    (candidate, candidateIndex) => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, candidateIndex) === rowKey,
  );
  if (originalExists) {
    tableState.dirty[tab][rowKey] = createCsvDeletedRow();
  } else {
    delete tableState.dirty[tab][rowKey];
  }
  return true;
}

function markRowDirty(tableState: ModTableState, tab: TableKey, rowKey: string, row: RowData) {
  const original = tableState.originalTables[tab].find(
    (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && resolveTableRowKey(tab, candidate, index) === rowKey,
  );
  delete tableState.dirty[tab][rowKey];
  if (!original) {
    tableState.dirty[tab][rowKey] = createCsvDirtyCells();
    const cells = csvDirtyCells(tableState.dirty[tab][rowKey]);
    if (!cells) return;
    for (const [key, value] of Object.entries(row)) {
      if (!isInternalJsonFieldKey(key)) cells[key] = cell(value);
    }
    return;
  }
  for (const [key, value] of Object.entries(row)) {
    if (isInternalJsonFieldKey(key)) continue;
    const next = cell(value);
    const prev = cell(original[key]);
    if (next !== prev) {
      const cells = ensureDirtyCells(tableState, tab, rowKey);
      cells[key] = next;
    }
  }
}

function ensureDirtyCells(tableState: ModTableState, tab: TableKey, rowKey: string): Record<string, string> {
  const existingCells = csvDirtyCells(tableState.dirty[tab][rowKey]);
  if (existingCells) return existingCells;
  tableState.dirty[tab][rowKey] = createCsvDirtyCells();
  return csvDirtyCells(tableState.dirty[tab][rowKey]) ?? {};
}
