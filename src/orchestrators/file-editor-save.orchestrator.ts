import { saveTextFile } from '@/services/files.service';

export function saveFileEditorTextWithUserAction(path: string, text: string) {
  return saveTextFile(path, text);
}
