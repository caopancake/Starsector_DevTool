import * as filesApi from '@/shared/api/files-api';
import type { EditableFileData, EditorSpecKind, WriteResult } from '@/shared/types';
import { writeTextFile } from '@/services/write.service';
import type { RowData } from '@/shared/types';

export function loadEditableFileData(sessionId: string | null, modRoot: string, path: string): Promise<EditableFileData> {
  return filesApi.loadEditableFile(sessionId, modRoot, path);
}

export function writeEditableFileText(sessionId: string | null, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return writeTextFile(sessionId, modRoot, path, text);
}

export function loadImportedEditorSpecFile(kind: EditorSpecKind, path: string): Promise<RowData> {
  return filesApi.loadImportedEditorSpecFile(kind, path);
}
