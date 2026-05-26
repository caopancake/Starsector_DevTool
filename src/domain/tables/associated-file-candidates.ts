import { normalizeRelPath, pathStem } from '@/shared/lib/paths';
import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { rowSpecId } from '@/shared/lib/starsector';
import { isCsvDeletedRow } from '@/domain/tables/csv-dirty';
import { associatedSpecCreateText, associatedSpecRelPath, tableHasAssociatedSpec } from '@/domain/tables/associated-specs';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';

export interface AssociatedFileCandidate {
  key: string;
  table: TableKey;
  action: 'create' | 'delete';
  id: string;
  label: string;
  relPath: string;
  afterText: string | null;
  afterDataBase64: string | null;
  previousRelPath: string | null;
}

export function associatedRelPath(table: TableKey, id: string): string | null {
  return associatedSpecRelPath(table, id);
}

export function isAssociatedFileForTable(table: TableKey, relPath: string): boolean {
  return associatedRelPath(table, pathStem(relPath)) === normalizeRelPath(relPath);
}

export function getAssociatedFileCandidates(
  state: ModTableState | undefined,
  table: TableKey,
  rowKeyForTab: (table: TableKey, row: RowData, index: number) => string,
): AssociatedFileCandidate[] {
  if (!state) return [];
  const result: AssociatedFileCandidate[] = [];
  if (!tableHasAssociatedSpec(table)) return result;
  for (const [rowKey, dirtyRow] of Object.entries(state.dirty[table])) {
    if (isCsvDeletedRow(dirtyRow)) {
      const originalIndex = state.originalTables[table].findIndex(
        (row, index) => isLoadedCsvTableRow(row) && rowKeyForTab(table, row, index) === rowKey,
      );
      const original = originalIndex >= 0 ? state.originalTables[table][originalIndex] : null;
      const id = original ? rowSpecId(original, table) : '';
      const relPath = associatedRelPath(table, id);
      if (!id || !relPath) continue;
      result.push({
        key: `${table}:delete:${id}`,
        table,
        action: 'delete',
        id,
        relPath,
        afterText: null,
        afterDataBase64: null,
        previousRelPath: null,
        label: `删除 ${relPath}`,
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
        const oldRelPath = associatedRelPath(table, oldId);
        const newRelPath = associatedRelPath(table, newId);
        if (oldRelPath && newRelPath) {
          result.push({
            key: `${table}:rename:${oldId}:${newId}`,
            table,
            action: 'create',
            id: newId,
            relPath: newRelPath,
            afterText: associatedSpecCreateText(table, newId, current),
            afterDataBase64: null,
            previousRelPath: oldRelPath,
            label: `重命名 ${oldRelPath} → ${newRelPath}`,
          });
        }
      }
      continue;
    }
    const row = state.tables[table].find(
      (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && rowKeyForTab(table, candidate, index) === rowKey,
    );
    const id = row ? rowSpecId(row, table) : '';
    const relPath = associatedRelPath(table, id);
    if (!row || !id || !relPath) continue;
    result.push({
      key: `${table}:create:${id}`,
      table,
      action: 'create',
      id,
      relPath,
      afterText: associatedSpecCreateText(table, id, row),
      afterDataBase64: null,
      previousRelPath: null,
      label: `创建 ${relPath}`,
    });
  }
  return result;
}
