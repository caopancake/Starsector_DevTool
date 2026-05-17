import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { useSettingsStore } from '../../app/settings.store';
import type { HistoryBarrier, HistoryCheckpoint, HistoryEntry, HistoryEvent, HistoryStackItem } from './history.types';
import { isBarrier, isCheckpoint, isEntry } from './history.types';

interface ModHistoryState {
  undoStack: HistoryStackItem[];
  redoStack: HistoryStackItem[];
}

function createModHistoryState(): ModHistoryState {
  return { undoStack: [], redoStack: [] };
}

let idCounter = 0;
function nextId(): string {
  return `hist_${Date.now()}_${++idCounter}`;
}

export const useHistoryStore = defineStore('history', () => {
  const stateMap = reactive<Map<string, ModHistoryState>>(new Map());
  const activeRoot = ref('');

  // --- Per-Mod lifecycle ---

  function activateFor(modRoot: string) {
    activeRoot.value = modRoot;
    if (!stateMap.has(modRoot)) {
      stateMap.set(modRoot, createModHistoryState());
    }
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function getActiveState(): ModHistoryState | undefined {
    return stateMap.get(activeRoot.value);
  }

  function getOrCreateState(modRoot: string): ModHistoryState {
    let state = stateMap.get(modRoot);
    if (!state) {
      state = createModHistoryState();
      stateMap.set(modRoot, state);
    }
    return state;
  }

  // --- Computed ---

  const canUndo = computed(() => {
    const state = getActiveState();
    if (!state) return false;
    for (let i = state.undoStack.length - 1; i >= 0; i--) {
      const item = state.undoStack[i];
      if (isBarrier(item)) return false;
      if (isEntry(item)) return true;
    }
    return false;
  });

  const canRedo = computed(() => {
    const state = getActiveState();
    if (!state) return false;
    for (let i = state.redoStack.length - 1; i >= 0; i--) {
      const item = state.redoStack[i];
      if (isBarrier(item)) return false;
      if (isEntry(item)) return true;
    }
    return false;
  });

  const undoLabel = computed(() => {
    const state = getActiveState();
    if (!state) return '';
    for (let i = state.undoStack.length - 1; i >= 0; i--) {
      const item = state.undoStack[i];
      if (isBarrier(item)) return '';
      if (isEntry(item)) return item.label;
    }
    return '';
  });

  const redoLabel = computed(() => {
    const state = getActiveState();
    if (!state) return '';
    for (let i = state.redoStack.length - 1; i >= 0; i--) {
      const item = state.redoStack[i];
      if (isBarrier(item)) return '';
      if (isEntry(item)) return item.label;
    }
    return '';
  });

  // --- Push ---

  function pushEvent(event: HistoryEvent, label: string) {
    const state = getActiveState();
    if (!state) return;
    pushEventToState(state, event, label);
  }

  function pushEventForMod(modRoot: string, event: HistoryEvent, label: string) {
    pushEventToState(getOrCreateState(modRoot), event, label);
  }

  function pushEventToState(state: ModHistoryState, event: HistoryEvent, label: string) {
    const settings = useSettingsStore();
    const entry: HistoryEntry = { id: nextId(), timestamp: Date.now(), event, label };
    state.undoStack.push(entry);
    state.redoStack.length = 0;
    trimToLimit(state, settings.historyLimit);
  }

  function pushBarrier(reason: HistoryBarrier['reason'], label: string) {
    const state = getActiveState();
    if (!state) return;
    const barrier: HistoryBarrier = { id: nextId(), timestamp: Date.now(), kind: 'barrier', reason, label };
    state.undoStack.push(barrier);
    state.redoStack.length = 0;
  }

  function pushCheckpoint(source: HistoryCheckpoint['source'], label: string) {
    const state = getActiveState();
    if (!state) return;
    pushCheckpointToState(state, source, label);
  }

  function pushCheckpointForMod(modRoot: string, source: HistoryCheckpoint['source'], label: string) {
    pushCheckpointToState(getOrCreateState(modRoot), source, label);
  }

  function pushCheckpointToState(state: ModHistoryState, source: HistoryCheckpoint['source'], label: string) {
    const settings = useSettingsStore();
    const checkpoint: HistoryCheckpoint = { id: nextId(), timestamp: Date.now(), kind: 'checkpoint', source, label };
    state.undoStack.push(checkpoint);
    trimToLimit(state, settings.historyLimit);
  }

  // --- Undo / Redo ---

  function undo(): HistoryEntry | null {
    const state = getActiveState();
    if (!state) return null;
    while (state.undoStack.length > 0) {
      const item = state.undoStack[state.undoStack.length - 1];
      if (isBarrier(item)) return null;
      if (isCheckpoint(item)) {
        state.undoStack.pop();
        state.redoStack.push(item);
        continue;
      }
      state.undoStack.pop();
      state.redoStack.push(item);
      return item;
    }
    return null;
  }

  function redo(): HistoryEntry | null {
    const state = getActiveState();
    if (!state) return null;
    while (state.redoStack.length > 0) {
      const item = state.redoStack[state.redoStack.length - 1];
      if (isBarrier(item)) return null;
      if (isCheckpoint(item)) {
        state.redoStack.pop();
        state.undoStack.push(item);
        continue;
      }
      state.redoStack.pop();
      state.undoStack.push(item);
      return item;
    }
    return null;
  }

  // --- Trim ---

  function trimToLimit(state: ModHistoryState, limit: number) {
    let entryCount = 0;
    for (const item of state.undoStack) {
      if (isEntry(item)) entryCount++;
    }
    while (entryCount > limit && state.undoStack.length > 0) {
      const removed = state.undoStack.shift()!;
      if (isEntry(removed)) entryCount--;
    }
  }

  // --- Clear ---

  function clearForMod(modRoot: string) {
    const state = stateMap.get(modRoot);
    if (state) {
      state.undoStack.length = 0;
      state.redoStack.length = 0;
    }
  }

  return {
    canRedo,
    canUndo,
    redoLabel,
    undoLabel,
    activateFor,
    clearForMod,
    pushBarrier,
    pushCheckpoint,
    pushCheckpointForMod,
    pushEvent,
    pushEventForMod,
    redo,
    removeModState,
    undo,
  };
});
