import { loadEditableFile } from '@/shared/api/files-api';
import type { EditableFileData, WriteResult } from '@/shared/types';
import { writeTextFile } from '@/services/write.service';

export function loadEditableFileData(path: string): Promise<EditableFileData> {
  return loadEditableFile(path);
}

export function writeEditableFileText(path: string, text: string): Promise<WriteResult> {
  return writeTextFile(path, text);
}
