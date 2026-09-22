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
import { deepClone } from '@/shared/lib/starsector';
import type { RowData } from '@/shared/types';

/// Canvas undo adapter over the edit-session undo primitive: entries are
/// deep-cloned ship snapshots so the draft can never alias the stack.
export function useCanvasHistory(limit = 250) {
  const stack = reactive(createUndoStackState<RowData>(limit));

  const canUndo = computed(() => canUndoEntry(stack));
  const canRedo = computed(() => canRedoEntry(stack));

  function push(value: RowData) {
    pushUndoEntry(stack, deepClone(value));
  }

  function undo(current: RowData): RowData | null {
    if (!canUndo.value) return null;
    const previous = popUndoEntry(stack);
    pushRedoEntry(stack, deepClone(current));
    return previous ?? null;
  }

  function redo(current: RowData): RowData | null {
    if (!canRedo.value) return null;
    const next = popRedoEntry(stack);
    pushUndoEntry(stack, deepClone(current), { clearRedo: false });
    return next ?? null;
  }

  function clear() {
    clearUndoStack(stack);
  }

  return { canRedo, canUndo, clear, push, redo, undo };
}
