import { deepClone } from '@/shared/lib/starsector';

export function useHistory<T>(limit = 250) {
  const undoStack: T[] = [];
  const redoStack: T[] = [];

  function push(value: T) {
    undoStack.push(deepClone(value));
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
  }

  function undo(current: T): T | null {
    const previous = undoStack.pop();
    if (!previous) return null;
    redoStack.push(deepClone(current));
    return deepClone(previous);
  }

  function redo(current: T): T | null {
    const next = redoStack.pop();
    if (!next) return null;
    undoStack.push(deepClone(current));
    return deepClone(next);
  }

  return {
    push,
    redo,
    undo,
  };
}
