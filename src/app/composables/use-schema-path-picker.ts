import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SchemaRuntimeContext } from '@/domain/schema/schema-runtime';
import { pathBelongsToRoot, relativePathFromRoot } from '@/shared/lib/paths';
import { pickFileDialog } from '@/shared/runtime/dialog.runtime';

export function useSchemaPathPicker(args: {
  runtimeContext: () => SchemaRuntimeContext | null | undefined;
  setPath: (path: string) => void;
}) {
  const feedback = useAppFeedback();

  async function pickPathFile() {
    const modRoot = args.runtimeContext()?.modRoot;
    if (!modRoot) return;

    const selected = await pickFileDialog({
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
