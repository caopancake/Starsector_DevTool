import { computed, ref } from 'vue';

export function useTextHistory() {
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function pushChange(previousText: string) {
    undoStack.value.push(previousText);
    redoStack.value = [];
  }

  function undo(currentText: string): string {
    if (!canUndo.value) return currentText;
    redoStack.value.push(currentText);
    return undoStack.value.pop() ?? currentText;
  }

  function redo(currentText: string): string {
    if (!canRedo.value) return currentText;
    undoStack.value.push(currentText);
    return redoStack.value.pop() ?? currentText;
  }

  function clear() {
    undoStack.value = [];
    redoStack.value = [];
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
