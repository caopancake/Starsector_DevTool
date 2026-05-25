import { fileToBase64 } from '@/shared/lib/starsector';
import { uploadEditorSpriteAction } from '@/orchestrators/sprite-upload.orchestrator';
import type { SpriteSubfolder, SpriteUploadResult } from '@/shared/types';
import type { AppFeedback } from '@/shared/types';

interface UploadSpriteOptions {
  feedback: AppFeedback;
  modRoot: string;
  subfolder: SpriteSubfolder;
  onUploaded: (result: SpriteUploadResult, dataUrl: string) => void;
}

export function useSpriteUpload() {
  async function uploadSpriteFromInput(event: Event, options: UploadSpriteOptions) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = await fileToBase64(file);
    const dataUrl = `data:image/png;base64,${data}`;
    let result = await uploadEditorSpriteAction(options.modRoot, file.name, data, options.subfolder, false);
    if (!result.state.exists) {
      options.onUploaded(result, dataUrl);
      return;
    }
    options.feedback.confirmWarning({
      title: '覆盖贴图？',
      content: result.state.message ?? '',
      actionText: '覆盖',
      onConfirm: async () => {
        result = await uploadEditorSpriteAction(options.modRoot, file.name, data, options.subfolder, true);
        options.onUploaded(result, dataUrl);
      },
    });
  }

  return { uploadSpriteFromInput };
}
