import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { ModTableState, TableKey } from '@/shared/types';
import { applyCsvEditRedo, applyCsvEditUndo } from '@/domain/tables/csv-edit-history';
import type { CsvDraftOperation, CsvEditHistoryEntry } from '@/shared/types/tables-edit-history.types';

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

export const useTablesEditHistoryStore = defineStore('tablesEditHistory', () => {
  const stateMap = reactive<Map<string, Map<TableKey, CsvEditHistoryState>>>(new Map());
  const historyLimit = ref(100);

  function getOrCreateState(modRoot: string, table: TableKey): CsvEditHistoryState {
    let tableStates = stateMap.get(modRoot);
    if (!tableStates) {
      tableStates = new Map();
      stateMap.set(modRoot, tableStates);
    }
    let state = tableStates.get(table);
    if (!state) {
      state = createState();
      tableStates.set(table, state);
    }
    return state;
  }

  function getState(modRoot: string, table: TableKey): CsvEditHistoryState | undefined {
    return stateMap.get(modRoot)?.get(table);
  }

  function pushCsvDraftOperation(modRoot: string, table: TableKey, operation: CsvDraftOperation, label: string) {
    if (!modRoot) return;
    const state = getOrCreateState(modRoot, table);
    state.undoStack.push({ id: nextId(), timestamp: Date.now(), operation, label });
    state.redoStack.length = 0;
    trimToLimit(state, historyLimit.value);
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
    const tableStates = stateMap.get(modRoot);
    tableStates?.delete(table);
    if (tableStates?.size === 0) stateMap.delete(modRoot);
  }

  function clearForMod(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function trimToLimit(state: CsvEditHistoryState, limit: number) {
    while (state.undoStack.length > limit) state.undoStack.shift();
  }

  function setHistoryLimit(limit: number) {
    historyLimit.value = limit;
    for (const tableStates of stateMap.values()) {
      for (const state of tableStates.values()) trimToLimit(state, historyLimit.value);
    }
  }

  return {
    canRedoCsvEdit,
    canUndoCsvEdit,
    clearCsvEditHistory,
    clearForMod,
    pushCsvDraftOperation,
    redoCsvEdit,
    setHistoryLimit,
    undoCsvEdit,
  };
});
