import { onMounted, onUnmounted } from 'vue';
import type { AppFeedback } from '@/shared/types';
import { mainWindowCommandFromKeyEvent } from '@/domain/workspace/main-window-commands';
import { dispatchMainRedoCommand, dispatchMainUndoCommand } from '@/orchestrators/main-history-command.orchestrator';

export function useMainWindowShortcuts(feedback: AppFeedback) {
  function handleKeyDown(event: KeyboardEvent) {
    const command = mainWindowCommandFromKeyEvent(event);
    if (!command) return;
    event.preventDefault();
    if (command === 'undo') void dispatchMainUndoCommand(feedback);
    if (command === 'redo') void dispatchMainRedoCommand(feedback);
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
}
