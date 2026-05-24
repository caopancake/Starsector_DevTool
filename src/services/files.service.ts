import { loadEditableFile as loadEditableFileApi } from '@/shared/api/write-api';
import type { EditableFileData, WriteResult } from '@/shared/api/write-api';
import { writeTextFile } from '@/services/write.service';

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return loadEditableFileApi(path);
}

export function saveTextFile(path: string, text: string): Promise<WriteResult> {
  return writeTextFile(path, text);
}
