import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { FileChangeRecord } from '@/shared/types';
import type { FileHistoryItem, FileSaveHistoryEntry } from '@/shared/types/file-history.types';
import { isFileSaveEntry } from '@/shared/types/file-history.types';

interface FileHistoryState {
  undoStack: FileHistoryItem[];
  redoStack: FileHistoryItem[];
}

function createState(): FileHistoryState {
  return { undoStack: [], redoStack: [] };
}

let idCounter = 0;
function nextId(): string {
  return `file_hist_${Date.now()}_${++idCounter}`;
}

export const useFileHistoryStore = defineStore('fileHistory', () => {
  const stateMap = reactive<Map<string, FileHistoryState>>(new Map());
  const activeRoot = ref<string | null>(null);
  const historyLimit = ref(100);

  function activateFor(modRoot: string | null) {
    activeRoot.value = modRoot;
    if (modRoot && !stateMap.has(modRoot)) stateMap.set(modRoot, createState());
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function getState(modRoot: string | null): FileHistoryState | undefined {
    return modRoot ? stateMap.get(modRoot) : undefined;
  }

  function getOrCreateState(modRoot: string): FileHistoryState {
    let state = stateMap.get(modRoot);
    if (!state) {
      state = createState();
      stateMap.set(modRoot, state);
    }
    return state;
  }

  const canUndoFileSave = computed(() => Boolean(peekFileUndo(activeRoot.value)));
  const canRedoFileSave = computed(() => Boolean(peekFileRedo(activeRoot.value)));
  const activeUndoStack = computed(() => getState(activeRoot.value)?.undoStack ?? []);
  const activeRedoStack = computed(() => getState(activeRoot.value)?.redoStack ?? []);
  const activeHistoryCount = computed(() => activeUndoStack.value.length + activeRedoStack.value.length);

  function pushFileSaveEntry(modRoot: string, changes: FileChangeRecord[], label: string) {
    if (!modRoot || changes.length === 0) return;
    const state = getOrCreateState(modRoot);
    state.undoStack.push({ id: nextId(), timestamp: Date.now(), kind: 'file-save', changes, label });
    state.redoStack.length = 0;
    trimToLimit(state, historyLimit.value);
  }

  function peekFileUndo(modRoot: string | null): FileSaveHistoryEntry | null {
    const state = getState(modRoot);
    if (!state) return null;
    for (let index = state.undoStack.length - 1; index >= 0; index--) {
      const item = state.undoStack[index];
      if (isFileSaveEntry(item)) return item;
    }
    return null;
  }

  function peekFileRedo(modRoot: string | null): FileSaveHistoryEntry | null {
    const state = getState(modRoot);
    if (!state) return null;
    for (let index = state.redoStack.length - 1; index >= 0; index--) {
      const item = state.redoStack[index];
      if (isFileSaveEntry(item)) return item;
    }
    return null;
  }

  function commitFileUndo(modRoot: string | null, entryId: string): boolean {
    const state = getState(modRoot);
    if (!state) return false;
    return moveCurrentFileSaveEntry(state.undoStack, state.redoStack, entryId);
  }

  function commitFileRedo(modRoot: string | null, entryId: string): boolean {
    const state = getState(modRoot);
    if (!state) return false;
    return moveCurrentFileSaveEntry(state.redoStack, state.undoStack, entryId);
  }

  function clearForMod(modRoot: string) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    state.undoStack.length = 0;
    state.redoStack.length = 0;
  }

  function getHistoryStacks(modRoot: string) {
    const state = stateMap.get(modRoot);
    return {
      undoStack: state?.undoStack ?? [],
      redoStack: state?.redoStack ?? [],
    };
  }

  function moveCurrentFileSaveEntry(from: FileHistoryItem[], to: FileHistoryItem[], entryId: string): boolean {
    const item = from[from.length - 1];
    if (!item || !isFileSaveEntry(item) || item.id !== entryId) return false;
    from.pop();
    to.push(item);
    return true;
  }

  function trimToLimit(state: FileHistoryState, limit: number) {
    let entryCount = 0;
    for (const item of state.undoStack) {
      if (isFileSaveEntry(item)) entryCount++;
    }
    while (entryCount > limit && state.undoStack.length > 0) {
      const removed = state.undoStack.shift()!;
      if (isFileSaveEntry(removed)) entryCount--;
    }
  }

  function setHistoryLimit(limit: number) {
    historyLimit.value = limit;
    for (const state of stateMap.values()) trimToLimit(state, historyLimit.value);
  }

  return {
    canRedoFileSave,
    canUndoFileSave,
    activeHistoryCount,
    activeRoot,
    activeRedoStack,
    activeUndoStack,
    activateFor,
    clearForMod,
    commitFileRedo,
    commitFileUndo,
    peekFileRedo,
    peekFileUndo,
    getHistoryStacks,
    pushFileSaveEntry,
    removeModState,
    setHistoryLimit,
  };
});
