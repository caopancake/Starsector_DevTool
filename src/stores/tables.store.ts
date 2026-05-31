import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import {
  TABLE_KEYS,
  CSV_FACTION_FIELD,
  type CsvRowKeyMapping,
  type CsvTableRows,
  type CsvTableWindow,
  type ModTableState,
  type ProjectManifest,
  type RowData,
  type TableKey,
} from '@/shared/types';
import { cell, deepClone, getColumns, MODULE_LABELS, rowDisplayId } from '@/shared/lib/starsector';
import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';
import { createCsvDeletedRow, createCsvDirtyCells, csvDirtyCells, hasCsvDirtyCells } from '@/domain/tables/csv-dirty';
import {
  DEFAULT_CSV_FACTION_FILTER,
  csvFactionFilterFromOptionValue,
  csvFactionFilterOptionValue,
  defaultCsvFactionId,
} from '@/domain/tables/csv-faction-filter';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { TABLE_ROW_KEY_FIELD, resolveTableRowKey } from '@/domain/tables/table-row-key';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';

function emptyDirtyState(): ModTableState['dirty'] {
  return emptyTableRecord(() => ({}));
}

function emptyTablesRecord(): Record<TableKey, CsvTableRows> {
  return emptyTableRecord(() => []);
}

function emptyHeadersRecord(): Record<TableKey, string[]> {
  return emptyTableRecord(() => []);
}

function emptyCountRecord(): Record<TableKey, number> {
  return emptyTableRecord(() => 0);
}

function emptyTableRecord<T>(createValue: () => T): Record<TableKey, T> {
  return Object.fromEntries(TABLE_KEYS.map((key) => [key, createValue()])) as Record<TableKey, T>;
}

function createModTableState(): ModTableState {
  return {
    tables: emptyTablesRecord(),
    originalTables: emptyTablesRecord(),
    headers: emptyHeadersRecord(),
    totalRows: emptyCountRecord(),
    filteredRows: emptyCountRecord(),
    dirty: emptyDirtyState(),
    currentTab: 'ships',
    currentFaction: DEFAULT_CSV_FACTION_FILTER,
    searchText: '',
    selectedRowKey: null,
    editing: null,
    nextRowKey: 0,
  };
}

function applyManifestSummaries(state: ModTableState, manifest: ProjectManifest) {
  for (const key of TABLE_KEYS) {
    const summary = manifest.tableSummaries[key];
    state.headers[key] = summary.header;
    state.totalRows[key] = summary.totalRows ?? 0;
    state.filteredRows[key] = summary.totalRows ?? 0;
  }
}

function mergeWindowRows(currentRows: CsvTableRows, windowRows: RowData[], start: number, rowCount: number): CsvTableRows {
  const nextRows = Array.from(
    { length: Math.max(currentRows.length, start + windowRows.length, rowCount) },
    (_, index) => currentRows[index] ?? null,
  );
  for (let index = 0; index < windowRows.length; index += 1) {
    nextRows[start + index] = windowRows[index];
  }
  return nextRows;
}

export const useTablesStore = defineStore('tables', () => {
  const csvEditHistory = useTablesEditHistoryStore();
  const stateMap = reactive<Map<string, ModTableState>>(new Map());
  const activeRoot = ref<string | null>(null);
  const saving = ref(false);

  function getActiveState(): ModTableState | undefined {
    return activeRoot.value ? stateMap.get(activeRoot.value) : undefined;
  }

  const tables = computed(() => getActiveState()?.tables ?? emptyTablesRecord());
  const currentTab = computed({
    get: () => getActiveState()?.currentTab ?? 'ships',
    set: (v) => {
      const s = getActiveState();
      if (s) s.currentTab = v;
    },
  });
  const currentFaction = computed({
    get: () => getActiveState()?.currentFaction ?? DEFAULT_CSV_FACTION_FILTER,
    set: (v) => {
      const s = getActiveState();
      if (s) s.currentFaction = v;
    },
  });
  const currentFactionOptionValue = computed({
    get: () => csvFactionFilterOptionValue(currentFaction.value),
    set: (v) => {
      currentFaction.value = csvFactionFilterFromOptionValue(v);
    },
  });
  const searchText = computed({
    get: () => getActiveState()?.searchText ?? '',
    set: (v) => {
      const s = getActiveState();
      if (s) s.searchText = v;
    },
  });
  const selectedRowKey = computed({
    get: () => getActiveState()?.selectedRowKey ?? null,
    set: (v) => {
      const s = getActiveState();
      if (s) s.selectedRowKey = v;
    },
  });
  const editing = computed({
    get: () => getActiveState()?.editing ?? null,
    set: (v) => {
      const s = getActiveState();
      if (s) s.editing = v;
    },
  });
  const dirty = computed(() => getActiveState()?.dirty ?? emptyDirtyState());

  const rows = computed(() => rowsFor(currentTab.value));
  const visibleColumns = computed(() => {
    const headerColumns = getColumns(currentTab.value, getActiveState()?.headers[currentTab.value] ?? []);
    if (headerColumns.length > 0) return headerColumns;
    const seen = new Set<string>();
    const inferred: string[] = [];
    for (const row of rows.value.filter(isLoadedCsvTableRow).slice(0, 50)) {
      for (const key of Object.keys(row)) {
        if (!isInternalJsonFieldKey(key) && !seen.has(key)) {
          seen.add(key);
          inferred.push(key);
        }
      }
    }
    return inferred;
  });
  const filteredRows = computed(() => rows.value);
  const filteredRowCount = computed(() => getActiveState()?.filteredRows[currentTab.value] ?? 0);
  const selectedRow = computed(() =>
    rows.value.find((row, index): row is RowData => isLoadedCsvTableRow(row) && tableRowKey(row, index) === selectedRowKey.value),
  );
  const tableInfo = computed(() => {
    const state = getActiveState();
    if (!state) return '显示 0 / 0 行';
    return `显示 ${state.filteredRows[state.currentTab]} / ${state.totalRows[state.currentTab]} 行`;
  });
  const hasAnyTableDirtyChanges = computed(() => TABLE_KEYS.some((key) => Object.keys(dirty.value[key]).length > 0));
  const hasCurrentTableChanges = computed(() => {
    const state = getActiveState();
    if (!state) return false;
    return Object.keys(state.dirty[state.currentTab]).length > 0 || state.editing?.tab === state.currentTab;
  });
  const canUndoCurrentTableEdit = computed(() =>
    activeRoot.value ? csvEditHistory.canUndoCsvEdit(activeRoot.value, currentTab.value) : false,
  );
  const canRedoCurrentTableEdit = computed(() =>
    activeRoot.value ? csvEditHistory.canRedoCsvEdit(activeRoot.value, currentTab.value) : false,
  );
  const hasAnyTableChanges = computed(() => hasAnyTableDirtyChanges.value || editing.value !== null);
  const activeModRoot = computed(() => activeRoot.value);

  // --- Per-Mod lifecycle ---

  function hydrate(modRoot: string, manifest: ProjectManifest) {
    const state = createModTableState();
    applyManifestSummaries(state, manifest);
    stateMap.set(modRoot, state);
    activateFor(modRoot, manifest);
  }

  function hydrateWithoutActivate(modRoot: string, manifest: ProjectManifest) {
    const state = createModTableState();
    applyManifestSummaries(state, manifest);
    stateMap.set(modRoot, state);
  }

  function activateFor(modRoot: string | null, manifest?: ProjectManifest | null) {
    activeRoot.value = modRoot;
    const state = getActiveState();
    if (state && manifest) applyManifestSummaries(state, manifest);
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
    activeRoot.value = getNextActiveKeyAfterRemoval(activeRoot.value, [...stateMap.keys()], modRoot, null);
  }

  function hasModDirtyChanges(modRoot: string): boolean {
    const state = stateMap.get(modRoot);
    if (!state) return false;
    return TABLE_KEYS.some((key) => Object.keys(state.dirty[key]).length > 0);
  }

  // --- Existing API ---

  function rowsFor(tab: TableKey): CsvTableRows {
    return getActiveState()?.tables[tab] ?? [];
  }

  function switchTab(tab: TableKey) {
    finishCellEdit();
    currentTab.value = tab;
    selectedRowKey.value = null;
    searchText.value = '';
    currentFaction.value = DEFAULT_CSV_FACTION_FILTER;
  }

  function applyTableWindow(window: CsvTableWindow) {
    const state = getActiveState();
    if (!state) return;
    const table = window.table;
    state.headers[table] = [...window.header];
    state.totalRows[table] = window.totalRows;
    state.filteredRows[table] = window.filteredRows;
    const rows = window.rows.map((item) => ({
      ...deepClone(item.row),
      [TABLE_ROW_KEY_FIELD]: item.rowKey,
    }));
    const mergedRows = mergeWindowRows(state.tables[table], rows, window.start, window.filteredRows);
    state.tables[table] = mergedRows;
    state.originalTables[table] = mergeWindowRows(state.originalTables[table], deepClone(rows), window.start, window.filteredRows);
  }

  function tableRowKey(row: RowData, index: number): string {
    return tableRowKeyForTab(currentTab.value, row, index);
  }

  function selectRowByKey(rowKey: string | null) {
    selectedRowKey.value = rowKey;
  }

  function isDirty(rowKey: string, col: string): boolean {
    return csvDirtyCells(dirty.value[currentTab.value][rowKey])?.[col] !== undefined;
  }

  function startCellEditByKey(rowKey: string, col: string, value: string) {
    editing.value = { tab: currentTab.value, rowKey, col, value };
  }

  function setEditingValue(value: string) {
    const state = getActiveState();
    if (state?.editing) state.editing.value = value;
  }

  function finishCellEdit() {
    const state = getActiveState();
    if (!state || !state.editing) return;
    const { tab, rowKey, col, value } = state.editing;
    applyCellValue(state, tab, rowKey, col, value);
    state.editing = null;
  }

  function updateCellValueByKey(rowKey: string, col: string, value: string) {
    const state = getActiveState();
    if (!state) return;
    applyCellValue(state, state.currentTab, rowKey, col, value);
  }

  function applyCellValue(state: ModTableState, tab: TableKey, rowKey: string, col: string, value: string) {
    const row = state.tables[tab].find(
      (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && tableRowKeyForTab(tab, candidate, index) === rowKey,
    );
    if (!row) return;
    const previousValue = cell(row[col]);
    row[col] = value;
    const original = state.originalTables[tab].find(
      (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && tableRowKeyForTab(tab, candidate, index) === rowKey,
    );
    const originalValue = cell(original?.[col]);
    if (value !== originalValue) {
      const cells = ensureDirtyCells(state, tab, rowKey);
      cells[col] = value;
    } else if (state.dirty[tab][rowKey]) {
      const cells = csvDirtyCells(state.dirty[tab][rowKey]);
      if (cells) delete cells[col];
      if (!hasCsvDirtyCells(state.dirty[tab][rowKey])) delete state.dirty[tab][rowKey];
    }
    state.editing = null;

    if (value !== previousValue) {
      if (!activeRoot.value) return;
      csvEditHistory.pushCsvEditEvent(
        activeRoot.value,
        tab,
        { type: 'csv-cell-edit', tab, rowKey, col, previousValue, newValue: value },
        `编辑 ${tab} [${col}]`,
      );
    }
  }

  function cancelCellEdit() {
    editing.value = null;
  }

  function undoCurrentTableEdit(): boolean {
    return activeRoot.value ? csvEditHistory.undoCsvEdit(activeRoot.value, currentTab.value, getActiveState()) : false;
  }

  function redoCurrentTableEdit(): boolean {
    return activeRoot.value ? csvEditHistory.redoCsvEdit(activeRoot.value, currentTab.value, getActiveState()) : false;
  }

  async function addNewRow() {
    const state = getActiveState();
    if (!state) return;
    const tab = state.currentTab;
    const id = `new_${tab}_${Date.now()}`;
    const header = state.headers[tab];
    const row: RowData = {};
    for (const col of header) row[col] = '';
    if ('id' in row) row.id = id;
    if ('name' in row) row.name = id;
    row[CSV_FACTION_FIELD] = defaultCsvFactionId();

    row[TABLE_ROW_KEY_FIELD] = `${tab}:new:${state.nextRowKey++}`;
    state.tables[tab].push(row);
    state.totalRows[tab] += 1;
    state.filteredRows[tab] += 1;
    const rowKey = tableRowKeyForTab(tab, row, state.tables[tab].length - 1);
    selectedRowKey.value = rowKey;
    markFullRowDirty(state, tab, row);

    if (!activeRoot.value) return;
    csvEditHistory.pushCsvEditEvent(
      activeRoot.value,
      tab,
      { type: 'row-create', tab, rowKey, rowIndex: state.tables[tab].length - 1, row: deepClone(row) },
      `新建 ${tab} 行: ${id}`,
    );
  }

  async function deleteSelected() {
    const state = getActiveState();
    if (!state) return;
    const tab = state.currentTab;
    const rowKey = state.selectedRowKey;
    if (!rowKey) return;

    const row = state.tables[tab].find(
      (candidate, index): candidate is RowData => isLoadedCsvTableRow(candidate) && tableRowKeyForTab(tab, candidate, index) === rowKey,
    );
    if (!row) {
      state.selectedRowKey = null;
      return;
    }

    const rowIndex = state.tables[tab].findIndex(
      (candidate, index) => isLoadedCsvTableRow(candidate) && tableRowKeyForTab(tab, candidate, index) === rowKey,
    );
    const id = rowDisplayId(row) || `第 ${rowIndex + 1} 行`;
    state.tables[tab] = state.tables[tab].filter((r) => r !== row);
    state.totalRows[tab] = Math.max(0, state.totalRows[tab] - 1);
    state.filteredRows[tab] = Math.max(0, state.filteredRows[tab] - 1);
    if (rowKey) {
      const originalExists = state.originalTables[tab].some(
        (candidate, index) => isLoadedCsvTableRow(candidate) && tableRowKeyForTab(tab, candidate, index) === rowKey,
      );
      if (originalExists) {
        state.dirty[tab][rowKey] = createCsvDeletedRow();
      } else {
        delete state.dirty[tab][rowKey];
      }
    }
    state.selectedRowKey = null;

    if (!activeRoot.value) return;
    csvEditHistory.pushCsvEditEvent(
      activeRoot.value,
      tab,
      { type: 'row-delete', tab, rowKey, rowIndex, row: deepClone(row) },
      `删除 ${tab} 行: ${id}`,
    );
  }

  function tableRowKeyForTab(tab: TableKey, row: RowData, index: number): string {
    return resolveTableRowKey(tab, row, index);
  }

  function markFullRowDirty(state: ModTableState, tab: TableKey, row: RowData) {
    const rowKey = tableRowKeyForTab(tab, row, state.tables[tab].indexOf(row));
    state.dirty[tab][rowKey] = createCsvDirtyCells();
    const cells = csvDirtyCells(state.dirty[tab][rowKey]);
    if (!cells) return;
    for (const [key, value] of Object.entries(row)) {
      if (!isInternalJsonFieldKey(key)) cells[key] = cell(value);
    }
  }

  function ensureDirtyCells(state: ModTableState, tab: TableKey, rowKey: string): Record<string, string> {
    const existingCells = csvDirtyCells(state.dirty[tab][rowKey]);
    if (existingCells) return existingCells;
    state.dirty[tab][rowKey] = createCsvDirtyCells();
    return csvDirtyCells(state.dirty[tab][rowKey]) ?? {};
  }

  function getActiveModTableState(): ModTableState | undefined {
    return getActiveState();
  }

  function getModTableState(modRoot: string): ModTableState | undefined {
    return stateMap.get(modRoot);
  }

  function replaceTableForMod(modRoot: string, tab: TableKey, rows: RowData[]) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    state.tables[tab] = deepClone(rows);
    state.originalTables[tab] = deepClone(state.tables[tab]);
    state.dirty[tab] = {};
  }

  function resetTableWindow(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    state.tables[tab] = [];
    state.originalTables[tab] = [];
    state.dirty[tab] = {};
    if (state.currentTab === tab) {
      state.selectedRowKey = null;
      state.editing = null;
    }
  }

  function markTableSavedForMod(modRoot: string, tab: TableKey) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    state.originalTables[tab] = deepClone(state.tables[tab]);
    state.dirty[tab] = {};
  }

  function applySavedRowKeyMapForMod(modRoot: string, tab: TableKey, keyMap: CsvRowKeyMapping[]) {
    const state = stateMap.get(modRoot);
    if (!state || keyMap.length === 0) return;
    const mapped = new Map(keyMap.map((item) => [item.previousKey, item.nextKey]));
    for (const row of state.tables[tab]) {
      if (!isLoadedCsvTableRow(row)) continue;
      const rowKey = cell(row[TABLE_ROW_KEY_FIELD]);
      const nextKey = mapped.get(rowKey);
      if (nextKey) row[TABLE_ROW_KEY_FIELD] = nextKey;
    }
    for (const row of state.originalTables[tab]) {
      if (!isLoadedCsvTableRow(row)) continue;
      const rowKey = cell(row[TABLE_ROW_KEY_FIELD]);
      const nextKey = mapped.get(rowKey);
      if (nextKey) row[TABLE_ROW_KEY_FIELD] = nextKey;
    }
    if (state.selectedRowKey) {
      state.selectedRowKey = mapped.get(state.selectedRowKey) ?? state.selectedRowKey;
    }
  }

  function setSaving(value: boolean) {
    saving.value = value;
  }

  return {
    currentFaction,
    currentFactionOptionValue,
    currentTab,
    activeModRoot,
    canRedoCurrentTableEdit,
    canUndoCurrentTableEdit,
    dirty,
    editing,
    filteredRowCount,
    filteredRows,
    hasCurrentTableChanges,
    hasAnyTableChanges,
    hasAnyTableDirtyChanges,
    isDirty,
    rows,
    saving,
    searchText,
    selectedRow,
    selectedRowKey,
    tableInfo,
    tables,
    visibleColumns,
    activateFor,
    addNewRow,
    cancelCellEdit,
    deleteSelected,
    finishCellEdit,
    getActiveModTableState,
    getModTableState,
    hasModDirtyChanges,
    hydrate,
    hydrateWithoutActivate,
    markTableSavedForMod,
    removeModState,
    replaceTableForMod,
    resetTableWindow,
    redoCurrentTableEdit,
    rowsFor,
    selectRowByKey,
    setSaving,
    startCellEditByKey,
    setEditingValue,
    switchTab,
    applySavedRowKeyMapForMod,
    applyTableWindow,
    tableRowKey,
    undoCurrentTableEdit,
    updateCellValueByKey,
  };
});

export { MODULE_LABELS };
