import { loadEditableFile } from '@/shared/api/files-api';
import type { EditableFileData, WriteResult } from '@/shared/types';
import { writeTextFile } from '@/services/write.service';

export function loadEditableFileData(sessionId: string | null, modRoot: string, path: string): Promise<EditableFileData> {
  return loadEditableFile(sessionId, modRoot, path);
}

export function writeEditableFileText(sessionId: string | null, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return writeTextFile(sessionId, modRoot, path, text);
}
