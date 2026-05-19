import { fileToBase64 } from '@/shared/lib/starsector';
import { uploadEditorSprite, type EditorSpriteUploadResult } from '@/services/editor.service';
import { recordSpriteUploadSaved } from '@/orchestrators/file-save.orchestrator';
import type { AppFeedback } from '@/shared/types';

type SpriteSubfolder = 'ships' | 'weapons' | 'missiles' | 'fx';
interface UploadSpriteOptions {
  feedback: AppFeedback;
  modRoot: string;
  subfolder: SpriteSubfolder;
  onUploaded: (result: EditorSpriteUploadResult, dataUrl: string) => void;
}

export function useSpriteUpload() {
  async function uploadSpriteFile(event: Event, options: UploadSpriteOptions) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = await fileToBase64(file);
    const dataUrl = `data:image/png;base64,${data}`;
    let result = await uploadEditorSprite(options.modRoot, file.name, data, options.subfolder, false);
    if (!result.exists) {
      options.onUploaded(result, dataUrl);
      recordSpriteUpload(options.modRoot, result, file.name);
      return;
    }
    options.feedback.confirmWarning({
      title: '覆盖贴图？',
      content: result.message,
      actionText: '覆盖',
      onConfirm: async () => {
        result = await uploadEditorSprite(options.modRoot, file.name, data, options.subfolder, true);
        options.onUploaded(result, dataUrl);
        recordSpriteUpload(options.modRoot, result, file.name);
      },
    });
  }

  return { uploadSpriteFile };
}

function recordSpriteUpload(modRoot: string, result: EditorSpriteUploadResult, filename: string) {
  if (!result.ok || result.changes.length === 0) return;
  recordSpriteUploadSaved(modRoot, result.changes, result.overwritten, filename);
}
