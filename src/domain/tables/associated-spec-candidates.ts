import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { rowSpecId } from '@/shared/lib/starsector';
import { isCsvDeletedRow } from '@/domain/tables/csv-dirty';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';
import type { AssociatedSpecChangeAction } from '@/shared/types';

export interface AssociatedSpecCandidate {
  action: AssociatedSpecChangeAction;
  key: string;
  table: TableKey;
  id: string;
  label: string;
  previousId: string | null;
  row: RowData;
}

export function getAssociatedSpecCandidates(
  state: ModTableState | undefined,
  table: TableKey,
  associatedSpecTables: readonly TableKey[],
  rowKeyForTab: (table: TableKey, row: RowData, index: number) => string,
): AssociatedSpecCandidate[] {
  if (!state) return [];
  const result: AssociatedSpecCandidate[] = [];
  if (!associatedSpecTables.includes(table)) return result;
  for (const [rowKey, dirtyRow] of Object.entries(state.dirty[table])) {
    if (isCsvDeletedRow(dirtyRow)) {
      const originalIndex = state.originalTables[table].findIndex(
        (row, index) => isLoadedCsvTableRow(row) && rowKeyForTab(table, row, index) === rowKey,
      );
      const original = originalIndex >= 0 ? state.originalTables[table][originalIndex] : null;
      const id = original ? rowSpecId(original, table) : '';
      if (!id) continue;
      result.push({
        key: associatedSpecCandidateKey(table, 'delete', id),
        table,
        action: 'delete',
        id,
        previousId: null,
        row: {},
        label: `删除关联 spec ${id}`,
      });
      continue;
    }

    const originalExists = state.originalTables[table].some(
      (row, index) => isLoadedCsvTableRow(row) && rowKeyForTab(table, row, index) === rowKey,
    );
    if (originalExists) {
      const original = state.originalTables[table].find(
        (row, index): row is RowData => isLoadedCsvTableRow(row) && rowKeyForTab(table, row, index) === rowKey,
      );
      const current = state.tables[table].find(
        (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && rowKeyForTab(table, candidate, index) === rowKey,
      );
      const oldId = original ? rowSpecId(original, table) : '';
      const newId = current ? rowSpecId(current, table) : '';
      if (oldId && newId && oldId !== newId && current) {
        result.push({
          key: associatedSpecCandidateKey(table, 'rename', oldId, newId),
          table,
          action: 'rename',
          id: newId,
          previousId: oldId,
          row: current,
          label: `重命名关联 spec ${oldId} -> ${newId}`,
        });
      }
      continue;
    }
    const row = state.tables[table].find(
      (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && rowKeyForTab(table, candidate, index) === rowKey,
    );
    const id = row ? rowSpecId(row, table) : '';
    if (!row || !id) continue;
    result.push({
      key: associatedSpecCandidateKey(table, 'create', id),
      table,
      action: 'create',
      id,
      previousId: null,
      row,
      label: `创建关联 spec ${id}`,
    });
  }
  return result;
}

function associatedSpecCandidateKey(table: TableKey, action: AssociatedSpecChangeAction, ...ids: string[]): string {
  return JSON.stringify([table, action, ids]);
}
