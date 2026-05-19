import { fileToBase64 } from '@/shared/lib/starsector';
import { uploadEditorSpriteWithHistory } from '@/orchestrators/sprite-upload.orchestrator';
import type { EditorSpriteUploadResult } from '@/services/editor.service';
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
    let result = await uploadEditorSpriteWithHistory(options.modRoot, file.name, data, options.subfolder, false);
    if (!result.exists) {
      options.onUploaded(result, dataUrl);
      return;
    }
    options.feedback.confirmWarning({
      title: '覆盖贴图？',
      content: result.message,
      actionText: '覆盖',
      onConfirm: async () => {
        result = await uploadEditorSpriteWithHistory(options.modRoot, file.name, data, options.subfolder, true);
        options.onUploaded(result, dataUrl);
      },
    });
  }

  return { uploadSpriteFile };
}
