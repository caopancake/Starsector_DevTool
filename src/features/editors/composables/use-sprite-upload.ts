import { fileToBase64 } from '../../../shared/lib/starsector';
import type { UploadResult } from '../../../shared/api/assets-api';
import { uploadEditorSprite } from '../editor-service';
import { recordFileSave } from '../../file-history/file-save-orchestrator';

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

interface UploadSpriteOptions {
  dialog: DialogLike;
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
      recordSpriteUpload(options.modRoot, result, file.name);
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
        recordSpriteUpload(options.modRoot, result, file.name);
      },
    });
  }

  return { uploadSpriteFile };
}

function recordSpriteUpload(modRoot: string, result: UploadResult, filename: string) {
  if (!result.ok || result.changes.length === 0) return;
  const action = result.overwritten ? '覆盖贴图' : '上传贴图';
  recordFileSave(modRoot, result.changes, `${action}: ${filename}`);
}
