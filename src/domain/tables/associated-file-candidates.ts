import { normalizeRelPath, pathStem } from '@/shared/lib/paths';
import type { ModTableState, RowData, TableKey } from '@/shared/types';
import { defaultShip, defaultWeapon, rowSpecId } from '@/shared/lib/starsector';

export interface AssociatedFileCandidate {
  key: string;
  table: TableKey;
  action: 'create' | 'delete';
  id: string;
  label: string;
  relPath: string;
  afterText?: string | null;
  afterDataBase64?: string | null;
}

export function associatedRelPath(table: TableKey, id: string): string | null {
  if (!id) return null;
  if (table === 'ships') return `data/hulls/${id}.ship`;
  if (table === 'weapons') return `data/weapons/${id}.wpn`;
  if (table === 'shipSystems') return `data/shipsystems/${id}.system`;
  if (table === 'skills') return `data/characters/skills/${id}.skill`;
  return null;
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
  if (!tableSupportsAssociatedFiles(table)) return result;
  for (const [rowKey, dirtyRow] of Object.entries(state.dirty[table])) {
    if (dirtyRow._deleted === 'true') {
      const originalIndex = state.originalTables[table].findIndex((row, index) => rowKeyForTab(table, row, index) === rowKey);
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
        label: `删除 ${relPath}`,
      });
      continue;
    }

    const originalExists = state.originalTables[table].some((row, index) => rowKeyForTab(table, row, index) === rowKey);
    if (originalExists) continue;
    const row = state.tables[table].find((candidate, index) => rowKeyForTab(table, candidate, index) === rowKey);
    const id = row ? rowSpecId(row, table) : '';
    const relPath = associatedRelPath(table, id);
    if (!row || !id || !relPath) continue;
    result.push({
      key: `${table}:create:${id}`,
      table,
      action: 'create',
      id,
      relPath,
      afterText: associatedCreateText(table, id, row),
      label: `创建 ${relPath}`,
    });
  }
  return result;
}

function associatedCreateText(table: TableKey, id: string, row: RowData): string {
  if (table === 'ships') return JSON.stringify(defaultShip(id), null, 2);
  if (table === 'weapons') return JSON.stringify(defaultWeapon(id, row), null, 2);
  return JSON.stringify({ id }, null, 2);
}

function tableSupportsAssociatedFiles(table: TableKey): boolean {
  return table === 'ships' || table === 'weapons' || table === 'shipSystems' || table === 'skills';
}
