import { uploadEditorSprite, type EditorSpriteUploadResult } from '@/services/editor.service';
import { invalidateWriteResultForMod, recordSpriteUploadSaved } from '@/orchestrators/file-save.orchestrator';

type SpriteSubfolder = 'ships' | 'weapons' | 'missiles' | 'fx';

export async function uploadEditorSpriteWithHistory(
  modRoot: string,
  filename: string,
  dataBase64: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<EditorSpriteUploadResult> {
  const result = await uploadEditorSprite(modRoot, filename, dataBase64, subfolder, overwrite);
  if (result.ok && result.changes.length > 0) {
    recordSpriteUploadSaved(modRoot, result.changes, result.overwritten, filename);
    await invalidateWriteResultForMod(modRoot, result);
  }
  return result;
}
