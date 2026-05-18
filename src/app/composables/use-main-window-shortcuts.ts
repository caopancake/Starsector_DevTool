import { onMounted, onUnmounted } from 'vue';
import { createAppFeedback } from '@/app/app-feedback';
import { redoMainWindow, undoMainWindow } from '@/orchestrators/main-undo-redo.orchestrator';

export function useMainWindowShortcuts() {
  const { message, dialog } = createAppFeedback(['message', 'dialog']);

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      void undoMainWindow(message, dialog);
      return;
    }
    if (event.ctrlKey && (event.key === 'y' || (event.key === 'Z' && event.shiftKey))) {
      event.preventDefault();
      void redoMainWindow(message, dialog);
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
}
