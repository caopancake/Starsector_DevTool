import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import { useSettingsStore } from '../../app/settings.store';
import type { ModTableState, TableKey } from '../../shared/types';
import { applyCsvEditRedo, applyCsvEditUndo } from './tables.edit-history.service';
import type { CsvEditHistoryEntry, CsvEditHistoryEvent } from './tables.edit-history.types';

interface CsvEditHistoryState {
  undoStack: CsvEditHistoryEntry[];
  redoStack: CsvEditHistoryEntry[];
}

function createState(): CsvEditHistoryState {
  return { undoStack: [], redoStack: [] };
}

let idCounter = 0;
function nextId(): string {
  return `csv_edit_${Date.now()}_${++idCounter}`;
}

function stateKey(modRoot: string, table: TableKey): string {
  return `${modRoot}::${table}`;
}

export const useTablesEditHistoryStore = defineStore('tablesEditHistory', () => {
  const stateMap = reactive<Map<string, CsvEditHistoryState>>(new Map());

  const hasAnyUndo = computed(() => [...stateMap.values()].some((state) => state.undoStack.length > 0));
  const hasAnyRedo = computed(() => [...stateMap.values()].some((state) => state.redoStack.length > 0));

  function getOrCreateState(modRoot: string, table: TableKey): CsvEditHistoryState {
    const key = stateKey(modRoot, table);
    let state = stateMap.get(key);
    if (!state) {
      state = createState();
      stateMap.set(key, state);
    }
    return state;
  }

  function getState(modRoot: string, table: TableKey): CsvEditHistoryState | undefined {
    return stateMap.get(stateKey(modRoot, table));
  }

  function pushCsvEditEvent(modRoot: string, table: TableKey, event: CsvEditHistoryEvent, label: string) {
    if (!modRoot) return;
    const settings = useSettingsStore();
    const state = getOrCreateState(modRoot, table);
    state.undoStack.push({ id: nextId(), timestamp: Date.now(), event, label });
    state.redoStack.length = 0;
    trimToLimit(state, settings.historyLimit);
  }

  function canUndoCsvEdit(modRoot: string, table: TableKey): boolean {
    return Boolean(getState(modRoot, table)?.undoStack.length);
  }

  function canRedoCsvEdit(modRoot: string, table: TableKey): boolean {
    return Boolean(getState(modRoot, table)?.redoStack.length);
  }

  function undoCsvEdit(modRoot: string, table: TableKey, tableState: ModTableState | undefined): boolean {
    const state = getState(modRoot, table);
    const entry = state?.undoStack[state.undoStack.length - 1];
    if (!state || !entry) return false;
    if (!applyCsvEditUndo(entry, tableState)) return false;
    state.undoStack.pop();
    state.redoStack.push(entry);
    return true;
  }

  function redoCsvEdit(modRoot: string, table: TableKey, tableState: ModTableState | undefined): boolean {
    const state = getState(modRoot, table);
    const entry = state?.redoStack[state.redoStack.length - 1];
    if (!state || !entry) return false;
    if (!applyCsvEditRedo(entry, tableState)) return false;
    state.redoStack.pop();
    state.undoStack.push(entry);
    return true;
  }

  function clearCsvEditHistory(modRoot: string, table: TableKey) {
    stateMap.delete(stateKey(modRoot, table));
  }

  function clearForMod(modRoot: string) {
    for (const key of [...stateMap.keys()]) {
      if (key.startsWith(`${modRoot}::`)) stateMap.delete(key);
    }
  }

  function trimToLimit(state: CsvEditHistoryState, limit: number) {
    while (state.undoStack.length > limit) state.undoStack.shift();
  }

  return {
    hasAnyRedo,
    hasAnyUndo,
    canRedoCsvEdit,
    canUndoCsvEdit,
    clearCsvEditHistory,
    clearForMod,
    pushCsvEditEvent,
    redoCsvEdit,
    undoCsvEdit,
  };
});
