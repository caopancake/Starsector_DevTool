import { saveTextFile } from '@/services/files.service';

export async function saveFileEditorTextWithUserAction(path: string, text: string) {
  const result = await saveTextFile(path, text);
  return result.changes;
}
