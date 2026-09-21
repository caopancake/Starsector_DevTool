import { computed, reactive } from 'vue';
import {
  canRedoEntry,
  canUndoEntry,
  clearUndoStack,
  createUndoStackState,
  popRedoEntry,
  popUndoEntry,
  pushRedoEntry,
  pushUndoEntry,
} from '@/domain/edit-session';

export function useTextHistory() {
  const stack = reactive(createUndoStackState<string>());

  const canUndo = computed(() => canUndoEntry(stack));
  const canRedo = computed(() => canRedoEntry(stack));

  function pushChange(previousText: string) {
    pushUndoEntry(stack, previousText);
  }

  function undo(currentText: string): string {
    if (!canUndo.value) return currentText;
    const previous = popUndoEntry(stack);
    pushRedoEntry(stack, currentText);
    return previous ?? currentText;
  }

  function redo(currentText: string): string {
    if (!canRedo.value) return currentText;
    const next = popRedoEntry(stack);
    pushUndoEntry(stack, currentText, { clearRedo: false });
    return next ?? currentText;
  }

  function clear() {
    clearUndoStack(stack);
  }

  return {
    canRedo,
    canUndo,
    clear,
    pushChange,
    redo,
    undo,
  };
}
