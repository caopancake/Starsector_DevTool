import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useDraftSessionsStore } from '@/stores/draft-sessions.store';

interface DraftTransitionConfirmationOptions {
  action: () => void | Promise<void>;
  content: string;
  title: string;
}

export function useDraftTransitionConfirmation() {
  const feedback = useAppFeedback();
  const draftSessions = useDraftSessionsStore();

  function confirmDraftTransition(modRoot: string | null, options: DraftTransitionConfirmationOptions): void {
    if (!modRoot || !draftSessions.hasDirtyDraftForMod(modRoot)) {
      void options.action();
      return;
    }
    feedback.confirmWarning({
      title: options.title,
      content: options.content,
      actionText: '放弃修改并继续',
      onConfirm: options.action,
    });
  }

  return { confirmDraftTransition };
}
