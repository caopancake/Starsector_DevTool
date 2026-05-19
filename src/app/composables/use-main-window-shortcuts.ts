import { onMounted, onUnmounted } from 'vue';
import type { AppFeedback } from '@/shared/types';
import { redoMainWindow, undoMainWindow } from '@/orchestrators/main-undo-redo.orchestrator';

export function useMainWindowShortcuts(feedback: AppFeedback) {
  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      void undoMainWindow(feedback);
      return;
    }
    if (event.ctrlKey && (event.key === 'y' || (event.key === 'Z' && event.shiftKey))) {
      event.preventDefault();
      void redoMainWindow(feedback);
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
}
