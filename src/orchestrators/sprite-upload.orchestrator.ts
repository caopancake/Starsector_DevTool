import { uploadEditorSprite } from '@/services/editor.service';
import { invalidateWriteResultForMod, recordSpriteUploadSaved } from '@/orchestrators/file-save.orchestrator';
import type { SpriteSubfolder, SpriteUploadResult } from '@/shared/types';

export async function uploadEditorSpriteAction(
  modRoot: string,
  filename: string,
  dataBase64: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<SpriteUploadResult> {
  const result = await uploadEditorSprite(modRoot, filename, dataBase64, subfolder, overwrite);
  if (result.state.ok && result.write.changes.length > 0) {
    recordSpriteUploadSaved(modRoot, result.write, result.state.overwritten, filename);
    await invalidateWriteResultForMod(modRoot, result.write);
  }
  return result;
}
