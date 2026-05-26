import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { cell, rowDisplayId } from '@/shared/lib/starsector';

const NEW_ROW_KEY_MARKER = ':new:';

export const TABLE_ROW_KEY_FIELD = '_rowKey';

export function assignTableRowKeys(state: ModTableState, table: TableKey, rows: RowData[]) {
  for (const row of rows) {
    assignTableRowKey(state, table, row);
  }
}

export function assignTableRowKey(state: ModTableState, table: TableKey, row: RowData) {
  if (!cell(row[TABLE_ROW_KEY_FIELD])) {
    row[TABLE_ROW_KEY_FIELD] = `${table}:rowKey:${state.nextRowKey++}`;
  }
}

export function resolveTableRowKey(table: TableKey, row: RowData, index: number): string {
  const existingKey = cell(row[TABLE_ROW_KEY_FIELD]);
  if (existingKey) return existingKey;
  const displayId = rowDisplayId(row);
  return displayId ? `${table}:id:${displayId}` : `${table}:row:${index}`;
}

/**
 * Returns true if this row was created by addNewRow() and has not yet been persisted.
 * New rows have a _rowKey matching the pattern `${table}:new:${counter}`.
 */
export function isUnsavedNewRow(row: RowData): boolean {
  const key = cell(row[TABLE_ROW_KEY_FIELD]);
  return key !== '' && key.includes(NEW_ROW_KEY_MARKER);
}
