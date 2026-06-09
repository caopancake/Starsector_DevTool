import { rowSpecId } from '@/shared/lib/starsector';
import { joinRootRelativePath } from '@/shared/lib/paths';
import type { EditorWindowKind, RowData, TableKey } from '@/shared/types';
import { isCsvCommentRow } from '@/domain/tables/csv-comment-row';
import { associatedSpecEditorKinds, associatedSpecRelPath } from '@/domain/tables/associated-specs';
import { editorWindowLabel } from '@/domain/editors/editor-definitions';

export type TableDetailAction =
  | { type: 'file-editor'; modRoot: string; path: string; sessionId: string; title: string; contextLabel?: string; message?: string }
  | {
      type: 'editor-window';
      kind: EditorWindowKind;
      modRoot: string;
      sessionId: string;
      starsectorRoot: string | null;
      id: string;
    };

export interface TableDetailActionContext {
  modRoot: string;
  sessionId: string;
  starsectorRoot: string | null;
}

export function detailActionsForRow(
  context: TableDetailActionContext,
  table: TableKey,
  row: RowData | null | undefined,
): TableDetailAction[] {
  if (!row) return [];
  if (isCsvCommentRow(row, table)) return [];
  const id = rowSpecId(row, table);
  if (!id) return [];
  const relPath = associatedSpecRelPath(table, id);
  const editorActions: TableDetailAction[] = associatedSpecEditorKinds(table).map((kind) => ({
    type: 'editor-window' as const,
    kind,
    modRoot: context.modRoot,
    sessionId: context.sessionId,
    starsectorRoot: context.starsectorRoot,
    id,
  }));
  return relPath ? [...editorActions, specFileAction(context, relPath)] : editorActions;
}

export function detailActionLabel(action: TableDetailAction): string {
  if (action.type === 'file-editor') return '文件编辑器';
  return editorWindowLabel(action.kind);
}

export function detailActionKey(action: TableDetailAction): string {
  return action.type === 'file-editor'
    ? JSON.stringify([action.type, action.modRoot, action.sessionId, action.path])
    : JSON.stringify([action.type, action.kind, action.modRoot, action.sessionId, action.id]);
}

function specFileAction(context: TableDetailActionContext, relPath: string): TableDetailAction {
  return {
    type: 'file-editor',
    modRoot: context.modRoot,
    path: joinRootRelativePath(context.modRoot, relPath),
    sessionId: context.sessionId,
    title: '文件编辑器',
  };
}
