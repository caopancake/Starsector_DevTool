import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { resolveModImageReference } from '@/services/resource-reference.service';
import { pickImageFileDialog } from '@/shared/runtime/dialog.runtime';

export function useResourceReference() {
  const feedback = useAppFeedback();

  async function pickModImageReference(options: { sessionId: string; modRoot: string; title?: string }): Promise<string | null> {
    const selected = await pickImageFileDialog({ defaultPath: options.modRoot, title: options.title ?? '选择贴图文件' });
    if (!selected) return null;
    try {
      return await resolveModImageReference(options.sessionId, options.modRoot, selected);
    } catch (error) {
      feedback.error(error);
      return null;
    }
  }

  return { pickModImageReference };
}
