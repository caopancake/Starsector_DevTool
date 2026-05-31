import { uploadEditorSprite } from '@/services/editor.service';
import { WINDOW_EVENTS, type SpriteUploadSavedEvent } from '@/windows/window.events';
import { emitWindowEvent } from '@/windows/tauri.events';
import type { SpriteSubfolder, SpriteUploadResult } from '@/shared/types';

export async function uploadEditorSpriteAction(
  sessionId: string,
  modRoot: string,
  filename: string,
  dataBase64: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<SpriteUploadResult> {
  const result = await uploadEditorSprite(sessionId, modRoot, filename, dataBase64, subfolder, overwrite);
  if (result.state.ok && result.write.changes.length > 0) {
    await emitSpriteUploadSaved({
      filename,
      modRoot,
      overwritten: result.state.overwritten,
      sessionId,
      writeResult: result.write,
    });
  }
  return result;
}

function emitSpriteUploadSaved(event: SpriteUploadSavedEvent) {
  return emitWindowEvent(WINDOW_EVENTS.spriteUploadSaved, event);
}
