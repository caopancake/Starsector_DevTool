import { invoke } from '@tauri-apps/api/core';
import type {
  AssociatedFileChange,
  EditableFileData,
  FileChangeRecord,
  FileChangeReplayDirection,
  ProjectSessionId,
  RowData,
  WriteResult,
} from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types/editor.types';

export function loadEditableFile(sessionId: ProjectSessionId, modRoot: string, path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { payload: { sessionId, modRoot, path } });
}

export function loadImportedEditorSpecFile(kind: EditorSpecKind, path: string): Promise<RowData> {
  return invoke('load_imported_editor_spec_file', { payload: { kind, path } });
}

export function saveTextFile(sessionId: ProjectSessionId, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return invoke('save_text_file', { payload: { sessionId, modRoot, path, text } });
}

export function saveEditorSpec(
  sessionId: ProjectSessionId,
  modRoot: string,
  kind: EditorSpecKind,
  id: string,
  data: RowData,
): Promise<WriteResult> {
  return invoke('save_editor_spec', { payload: { sessionId, modRoot, kind, id, data } });
}

export function saveModFiles(sessionId: ProjectSessionId, modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return invoke('save_mod_files', { payload: { sessionId, modRoot, files } });
}

export function applyFileChangeSet(
  sessionId: ProjectSessionId,
  modRoot: string,
  direction: FileChangeReplayDirection,
  changes: FileChangeRecord[],
): Promise<WriteResult> {
  return invoke('apply_file_change_set', { payload: { sessionId, modRoot, direction, changes } });
}
