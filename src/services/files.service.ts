import { loadEditableFile as loadEditableFileApi, saveTextFile as saveTextFileApi } from '@/shared/api/files-api';
import type { EditableFileData, FileChangeRecord } from '@/shared/api/files-api';

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return loadEditableFileApi(path);
}

export function saveTextFile(path: string, text: string): Promise<FileChangeRecord[]> {
  return saveTextFileApi(path, text);
}
