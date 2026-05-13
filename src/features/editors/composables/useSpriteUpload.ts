import { fileToBase64 } from '../../../shared/lib/starsector';
import type { UploadResult } from '../../../shared/api/tauri';
import { uploadEditorSprite } from '../editor.service';

type SpriteSubfolder = 'ships' | 'weapons' | 'missiles' | 'fx';
type DialogLike = {
  warning: (options: {
    title: string;
    content?: string;
    positiveText: string;
    negativeText: string;
    onPositiveClick: () => void | Promise<void>;
  }) => unknown;
};
type MessageLike = {
  success: (content: string) => unknown;
};

interface UploadSpriteOptions {
  dialog: DialogLike;
  message: MessageLike;
  modRoot: string;
  subfolder: SpriteSubfolder;
  onUploaded: (result: UploadResult, dataUrl: string) => void;
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
      options.message.success('贴图已上传');
      return;
    }
    options.dialog.warning({
      title: '覆盖贴图？',
      content: result.message,
      positiveText: '覆盖',
      negativeText: '取消',
      onPositiveClick: async () => {
        result = await uploadEditorSprite(options.modRoot, file.name, data, options.subfolder, true);
        options.onUploaded(result, dataUrl);
        options.message.success('贴图已上传');
      },
    });
  }

  return { uploadSpriteFile };
}
