import { rowSpecId } from '@/shared/lib/starsector';
import { joinRootRelativePath, pathBasename } from '@/shared/lib/paths';
import type { EditorWindowKind, RowData, TableKey } from '@/shared/types';
import { isCsvCommentRow } from '@/domain/tables/csv-comment-row';
import { associatedSpecEditorKinds, associatedSpecRelPath } from '@/domain/tables/associated-specs';
import { editorWindowLabel } from '@/domain/editors/editor-kind-metadata';

export type TableDetailAction =
  | { type: 'file-editor'; path: string; title: string; contextLabel: string; message: string }
  | { type: 'editor-window'; kind: EditorWindowKind; id: string };

export function detailActionsForRow(modRoot: string, table: TableKey, row: RowData | null | undefined): TableDetailAction[] {
  if (!row) return [];
  if (isCsvCommentRow(row, table)) return [];
  const id = rowSpecId(row, table);
  if (!id) return [];
  const relPath = associatedSpecRelPath(table, id);
  if (!relPath) return [];
  return [
    specFileAction(modRoot, relPath),
    ...associatedSpecEditorKinds(table).map((kind) => ({ type: 'editor-window' as const, kind, id })),
  ];
}

export function detailActionLabel(action: TableDetailAction): string {
  if (action.type === 'file-editor') return '文件编辑器';
  return editorWindowLabel(action.kind);
}

export function detailActionKey(action: TableDetailAction): string {
  return action.type === 'file-editor' ? `${action.type}:${action.path}` : `${action.type}:${action.kind}:${action.id}`;
}

function specFileAction(modRoot: string, relPath: string): TableDetailAction {
  const title = pathBasename(relPath);
  return {
    type: 'file-editor',
    path: joinRootRelativePath(modRoot, relPath),
    title: '文件编辑器',
    contextLabel: title,
    message: title,
  };
}
