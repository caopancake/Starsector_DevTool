import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { useSettingsStore } from '../../app/settings.store';
import type { FileChangeRecord } from '../../shared/api/tauri';
import type { FileHistoryBarrier, FileHistoryItem, FileSaveHistoryEntry } from './file.history.types';
import { isFileHistoryBarrier, isFileSaveEntry } from './file.history.types';

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
  const activeRoot = ref('');

  function activateFor(modRoot: string) {
    activeRoot.value = modRoot;
    if (modRoot && !stateMap.has(modRoot)) stateMap.set(modRoot, createState());
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function getActiveState(): FileHistoryState | undefined {
    return activeRoot.value ? stateMap.get(activeRoot.value) : undefined;
  }

  function getOrCreateState(modRoot: string): FileHistoryState {
    let state = stateMap.get(modRoot);
    if (!state) {
      state = createState();
      stateMap.set(modRoot, state);
    }
    return state;
  }

  const canUndoFileSave = computed(() => Boolean(peekFileUndo()));
  const canRedoFileSave = computed(() => Boolean(peekFileRedo()));
  const undoFileLabel = computed(() => peekFileUndo()?.label ?? '');
  const redoFileLabel = computed(() => peekFileRedo()?.label ?? '');

  function pushFileSaveEntry(modRoot: string, changes: FileChangeRecord[], label: string) {
    if (!modRoot || changes.length === 0) return;
    const settings = useSettingsStore();
    const state = getOrCreateState(modRoot);
    state.undoStack.push({ id: nextId(), timestamp: Date.now(), kind: 'file-save', changes, label });
    state.redoStack.length = 0;
    trimToLimit(state, settings.historyLimit);
  }

  function pushFileHistoryBarrier(modRoot: string, reason: FileHistoryBarrier['reason'], label: string) {
    if (!modRoot) return;
    const state = getOrCreateState(modRoot);
    state.undoStack.push({ id: nextId(), timestamp: Date.now(), kind: 'barrier', reason, label });
    state.redoStack.length = 0;
  }

  function peekFileUndo(): FileSaveHistoryEntry | null {
    const state = getActiveState();
    if (!state) return null;
    for (let index = state.undoStack.length - 1; index >= 0; index--) {
      const item = state.undoStack[index];
      if (isFileHistoryBarrier(item)) return null;
      if (isFileSaveEntry(item)) return item;
    }
    return null;
  }

  function peekFileRedo(): FileSaveHistoryEntry | null {
    const state = getActiveState();
    if (!state) return null;
    for (let index = state.redoStack.length - 1; index >= 0; index--) {
      const item = state.redoStack[index];
      if (isFileHistoryBarrier(item)) return null;
      if (isFileSaveEntry(item)) return item;
    }
    return null;
  }

  function commitFileUndo(entryId: string): boolean {
    const state = getActiveState();
    if (!state) return false;
    return moveEntry(state.undoStack, state.redoStack, entryId);
  }

  function commitFileRedo(entryId: string): boolean {
    const state = getActiveState();
    if (!state) return false;
    return moveEntry(state.redoStack, state.undoStack, entryId);
  }

  function clearForMod(modRoot: string) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    state.undoStack.length = 0;
    state.redoStack.length = 0;
  }

  function moveEntry(from: FileHistoryItem[], to: FileHistoryItem[], entryId: string): boolean {
    while (from.length > 0) {
      const item = from[from.length - 1];
      if (isFileHistoryBarrier(item)) return false;
      from.pop();
      to.push(item);
      if (isFileSaveEntry(item) && item.id === entryId) return true;
    }
    return false;
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

  return {
    canRedoFileSave,
    canUndoFileSave,
    redoFileLabel,
    undoFileLabel,
    activateFor,
    clearForMod,
    commitFileRedo,
    commitFileUndo,
    peekFileRedo,
    peekFileUndo,
    pushFileHistoryBarrier,
    pushFileSaveEntry,
    removeModState,
  };
});
