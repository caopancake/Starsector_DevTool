import type { AppFeedback } from '@/shared/types';
import { dispatchMainRedoCommand, dispatchMainUndoCommand } from '@/orchestrators/main-history-command.orchestrator';
import { dispatchSaveCommand } from '@/shared/lib/save-command-registry';
import { useShortcutDispatch } from '@/app/composables/use-shortcut-dispatch';

export function useMainWindowShortcuts(feedback: AppFeedback) {
  useShortcutDispatch({
    commands: {
      save: () => dispatchSaveCommand(),
      undo: () => void dispatchMainUndoCommand(feedback),
      redo: () => void dispatchMainRedoCommand(feedback),
    },
  });
}
