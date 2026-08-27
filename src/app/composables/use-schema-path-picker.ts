import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SchemaRuntimeContext } from '@/domain/schema/schema-runtime';
import { pathBelongsToRoot, relativePathFromRoot } from '@/shared/lib/paths';
import { pickFileDialog, pickImageFileDialog } from '@/shared/runtime/dialog.runtime';

export function useSchemaPathPicker(args: {
  runtimeContext: () => SchemaRuntimeContext | null | undefined;
  setPath: (path: string) => void;
}) {
  const feedback = useAppFeedback();

  async function pickPathFile(options: { imageFilter?: boolean } = {}) {
    const modRoot = args.runtimeContext()?.modRoot;
    if (!modRoot) return;

    const selected = options.imageFilter
      ? await pickImageFileDialog({ title: '选择图片文件', defaultPath: modRoot })
      : await pickFileDialog({
          title: '选择文件',
          defaultPath: modRoot,
        });

    if (!selected || typeof selected !== 'string') return;

    if (pathBelongsToRoot(selected, modRoot)) {
      args.setPath(relativePathFromRoot(modRoot, selected));
      return;
    }
    feedback.warning('路径字段只能选择当前 Mod 目录内的文件');
  }

  return {
    pickPathFile,
  };
}
