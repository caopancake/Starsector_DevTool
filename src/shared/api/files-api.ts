import { invoke } from '@tauri-apps/api/core';
import type {
  AssociatedFileChange,
  EditableFileData,
  FileChangeRecord,
  FileChangeReplayDirection,
  RowData,
  WriteResult,
} from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types/editor.types';

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { payload: { path } });
}

export function saveTextFile(path: string, text: string): Promise<WriteResult> {
  return invoke('save_text_file', { payload: { path, text } });
}

export function saveEditorSpec(modRoot: string, kind: EditorSpecKind, id: string, data: RowData): Promise<WriteResult> {
  return invoke('save_editor_spec', { payload: { modRoot, kind, id, data } });
}

export function saveModFiles(modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return invoke('save_mod_files', { payload: { modRoot, files } });
}

export function replayFileChangeSetOnDisk(direction: FileChangeReplayDirection, changes: FileChangeRecord[]): Promise<WriteResult> {
  return invoke('apply_file_change_set', { payload: { direction, changes } });
}
