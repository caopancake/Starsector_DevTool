import { invoke } from '@tauri-apps/api/core';
import type { EditableFileData, ProjectSessionId, RowData } from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types/editor.types';

export function loadEditableFile(sessionId: ProjectSessionId, modRoot: string, path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { payload: { sessionId, modRoot, path } });
}

export function loadImportedEditorSpecFile(kind: EditorSpecKind, path: string): Promise<RowData> {
  return invoke('load_imported_editor_spec_file', { payload: { kind, path } });
}
