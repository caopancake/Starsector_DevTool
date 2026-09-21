import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { createUndoStack, type UndoStack } from '@/domain/edit-session';
import type { ModTableState, TableKey } from '@/shared/types';
import { applyCsvEditRedo, applyCsvEditUndo } from '@/domain/tables/csv-edit-history';
import type { CsvDraftOperation, CsvEditHistoryEntry } from '@/shared/types/tables-edit-history.types';

type CsvEditHistoryStack = UndoStack<CsvEditHistoryEntry>;

function createCsvEditHistoryStack(): CsvEditHistoryStack {
  return createUndoStack<CsvEditHistoryEntry>({ idPrefix: 'csv_edit' });
}

export const useTablesEditHistoryStore = defineStore('tablesEditHistory', () => {
  const stateMap = reactive<Map<string, Map<TableKey, CsvEditHistoryStack>>>(new Map());
  const historyLimit = ref(100);

  function getOrCreateState(modRoot: string, table: TableKey): CsvEditHistoryStack {
    let tableStates = stateMap.get(modRoot);
    if (!tableStates) {
      tableStates = new Map();
      stateMap.set(modRoot, tableStates);
    }
    let stack = tableStates.get(table);
    if (!stack) {
      stack = createCsvEditHistoryStack();
      tableStates.set(table, stack);
    }
    return stack;
  }

  function getStack(modRoot: string, table: TableKey): CsvEditHistoryStack | undefined {
    return stateMap.get(modRoot)?.get(table);
  }

  function pushCsvDraftOperation(modRoot: string, table: TableKey, operation: CsvDraftOperation, label: string) {
    if (!modRoot) return;
    const stack = getOrCreateState(modRoot, table);
    stack.push({ id: stack.nextId(), timestamp: Date.now(), operation, label });
  }

  function canUndoCsvEdit(modRoot: string, table: TableKey): boolean {
    return getStack(modRoot, table)?.canUndo() ?? false;
  }

  function canRedoCsvEdit(modRoot: string, table: TableKey): boolean {
    return getStack(modRoot, table)?.canRedo() ?? false;
  }

  function undoCsvEdit(modRoot: string, table: TableKey, tableState: ModTableState | undefined): boolean {
    const stack = getStack(modRoot, table);
    const entry = stack?.peekUndo();
    if (!stack || !entry) return false;
    if (!applyCsvEditUndo(entry, tableState)) return false;
    stack.popUndo();
    stack.pushRedo(entry);
    return true;
  }

  function redoCsvEdit(modRoot: string, table: TableKey, tableState: ModTableState | undefined): boolean {
    const stack = getStack(modRoot, table);
    const entry = stack?.peekRedo();
    if (!stack || !entry) return false;
    if (!applyCsvEditRedo(entry, tableState)) return false;
    stack.popRedo();
    stack.pushUndo(entry);
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

  function setHistoryLimit(limit: number) {
    historyLimit.value = limit;
    for (const tableStates of stateMap.values()) {
      for (const stack of tableStates.values()) stack.setLimit(limit);
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
