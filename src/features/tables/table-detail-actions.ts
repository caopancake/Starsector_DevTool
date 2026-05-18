import { rowSpecId } from '../../shared/lib/starsector';
import type { RowData, TableKey } from '../../shared/types';

export type TableDetailAction =
  | { type: 'file-editor'; path: string; title: string; contextLabel: string; message: string }
  | { type: 'ship-editor'; id: string }
  | { type: 'weapon-editor'; id: string }
  | { type: 'weapon-preview'; id: string };

export function fileEditorActionForRow(modRoot: string, table: TableKey, row: RowData | null | undefined): TableDetailAction | null {
  if (!row) return null;
  const id = rowSpecId(row, table);
  if (!id) return null;
  if (table === 'ships') return specFileAction(modRoot, ['data', 'hulls', `${id}.ship`], `${id}.ship`);
  if (table === 'weapons') return specFileAction(modRoot, ['data', 'weapons', `${id}.wpn`], `${id}.wpn`);
  if (table === 'shipSystems') return specFileAction(modRoot, ['data', 'shipsystems', `${id}.system`], `${id}.system`);
  if (table === 'skills') return specFileAction(modRoot, ['data', 'characters', 'skills', `${id}.skill`], `${id}.skill`);
  return null;
}

function specFileAction(modRoot: string, parts: string[], title: string): TableDetailAction {
  return {
    type: 'file-editor',
    path: joinModPath(modRoot, ...parts),
    title: '文件编辑器',
    contextLabel: title,
    message: title,
  };
}

function joinModPath(modRoot: string, ...parts: string[]): string {
  return [modRoot.replace(/[\\/]+$/, ''), ...parts].join('\\');
}
