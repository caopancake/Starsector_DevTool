import { computed, reactive } from 'vue';
import { createUndoStack } from '@/domain/edit-session';

export function useTextHistory() {
  const stack = reactive(createUndoStack<string>());

  const canUndo = computed(() => stack.canUndo());
  const canRedo = computed(() => stack.canRedo());

  function pushChange(previousText: string) {
    stack.push(previousText);
  }

  function undo(currentText: string): string {
    if (!canUndo.value) return currentText;
    const previous = stack.popUndo();
    stack.pushRedo(currentText);
    return previous ?? currentText;
  }

  function redo(currentText: string): string {
    if (!canRedo.value) return currentText;
    const next = stack.popRedo();
    stack.pushUndo(currentText);
    return next ?? currentText;
  }

  function clear() {
    stack.clear();
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
