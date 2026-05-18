import { invoke } from '@tauri-apps/api/core';
import type { RowData } from '../types';
import type { AssociatedFileChange } from './tables-api';

export interface EditableFileData {
  path: string;
  text: string;
}

export interface FileChangeRecord {
  kind: 'file' | 'directory';
  path: string;
  beforeExists: boolean;
  beforeText?: string | null;
  beforeDataBase64?: string | null;
  beforeFiles: FileSnapshot[];
  afterExists: boolean;
  afterText?: string | null;
  afterDataBase64?: string | null;
  afterFiles: FileSnapshot[];
}

export interface FileSnapshot {
  relPath: string;
  text?: string | null;
  dataBase64?: string | null;
}

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { path });
}

export function saveTextFileWithHistory(path: string, text: string): Promise<FileChangeRecord[]> {
  return invoke('save_text_file_with_history', { payload: { path, text } });
}

export function saveJsonWithHistory(
  modRoot: string,
  relDir: string,
  ext: string,
  idKey: string,
  id: string,
  data: RowData,
): Promise<FileChangeRecord[]> {
  return invoke('save_json_with_history', { payload: { modRoot, relDir, ext, idKey, id, data } });
}

export function saveModFilesWithHistory(modRoot: string, files: AssociatedFileChange[]): Promise<FileChangeRecord[]> {
  return invoke('save_mod_files_with_history', { payload: { modRoot, files } });
}

export function applyFileChangeSet(direction: 'undo' | 'redo', changes: FileChangeRecord[]): Promise<void> {
  return invoke('apply_file_change_set', { payload: { direction, changes } });
}
