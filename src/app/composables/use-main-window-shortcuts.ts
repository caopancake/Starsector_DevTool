import type { AppFeedback } from '@/shared/types';
import { dispatchMainRedoCommand, dispatchMainUndoCommand } from '@/orchestrators/main-history-command.orchestrator';
import { useSaveCommandStore } from '@/stores/save-command.store';
import { useShortcutDispatch } from '@/app/composables/use-shortcut-dispatch';

export function useMainWindowShortcuts(feedback: AppFeedback) {
  const saveCommand = useSaveCommandStore();
  useShortcutDispatch({
    commands: {
      save: () => saveCommand.dispatchSaveCommand(),
      undo: () => void dispatchMainUndoCommand(feedback),
      redo: () => void dispatchMainRedoCommand(feedback),
    },
  });
}
