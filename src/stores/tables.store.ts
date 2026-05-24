import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { CsvTableWindow, ModTableState, ProjectManifest, RowData, TableKey } from '@/shared/types';
import { cell, deepClone, getColumns, MODULE_LABELS, rowDisplayId } from '@/shared/lib/starsector';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { TABLE_ROW_KEY_FIELD, resolveTableRowKey } from '@/domain/tables/table-row-key';

export const TABLE_KEYS: TableKey[] = [
  'ships',
  'weapons',
  'wings',
  'hullmods',
  'shipSystems',
  'industries',
  'skills',
  'abilities',
  'commodities',
  'specialItems',
  'submarkets',
  'marketConditions',
  'simOpponents',
  'descriptions',
];

function emptyDirtyState(): Record<TableKey, Record<string, Record<string, string>>> {
  return {
    ships: {},
    weapons: {},
    wings: {},
    hullmods: {},
    shipSystems: {},
    industries: {},
    skills: {},
    abilities: {},
    commodities: {},
    specialItems: {},
    submarkets: {},
    marketConditions: {},
    simOpponents: {},
    descriptions: {},
  };
}

function emptyTablesRecord(): Record<TableKey, RowData[]> {
  return {
    ships: [],
    weapons: [],
    wings: [],
    hullmods: [],
    shipSystems: [],
    industries: [],
    skills: [],
    abilities: [],
    commodities: [],
    specialItems: [],
    submarkets: [],
    marketConditions: [],
    simOpponents: [],
    descriptions: [],
  };
}

function emptyHeadersRecord(): Record<TableKey, string[]> {
  return {
    ships: [],
    weapons: [],
    wings: [],
    hullmods: [],
    shipSystems: [],
    industries: [],
    skills: [],
    abilities: [],
    commodities: [],
    specialItems: [],
    submarkets: [],
    marketConditions: [],
    simOpponents: [],
    descriptions: [],
  };
}

function emptyCountRecord(): Record<TableKey, number> {
  return {
    ships: 0,
    weapons: 0,
    wings: 0,
    hullmods: 0,
    shipSystems: 0,
    industries: 0,
    skills: 0,
    abilities: 0,
    commodities: 0,
    specialItems: 0,
    submarkets: 0,
    marketConditions: 0,
    simOpponents: 0,
    descriptions: 0,
  };
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
    currentFaction: 'all',
    searchText: '',
    selectedRowKey: '',
    editing: null,
    nextRowKey: 0,
  };
}

function applyManifestSummaries(state: ModTableState, manifest: ProjectManifest) {
  for (const key of TABLE_KEYS) {
    const summary = manifest.tableSummaries[key];
    state.headers[key] = summary?.header ?? [];
    state.totalRows[key] = summary?.totalRows ?? 0;
    state.filteredRows[key] = summary?.totalRows ?? 0;
  }
}

function mergeWindowRows(currentRows: RowData[], windowRows: RowData[], start: number): RowData[] {
  const nextRows = Array.from({ length: Math.max(currentRows.length, start + windowRows.length) }, (_, index) => {
    const existing = currentRows[index];
    return existing ?? { [TABLE_ROW_KEY_FIELD]: `__placeholder:${index}` };
  });
  for (let index = 0; index < windowRows.length; index += 1) {
    nextRows[start + index] = windowRows[index];
  }
  return nextRows;
}

export const useTablesStore = defineStore('tables', () => {
  const csvEditHistory = useTablesEditHistoryStore();
  const stateMap = reactive<Map<string, ModTableState>>(new Map());
  const activeRoot = ref('');
  const saving = ref(false);

  function getActiveState(): ModTableState | undefined {
    return stateMap.get(activeRoot.value);
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
    get: () => getActiveState()?.currentFaction ?? 'all',
    set: (v) => {
      const s = getActiveState();
      if (s) s.currentFaction = v;
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
    get: () => getActiveState()?.selectedRowKey ?? '',
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
    for (const row of rows.value.slice(0, 50)) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('_') && !seen.has(key)) {
          seen.add(key);
          inferred.push(key);
        }
      }
    }
    return inferred;
  });
  const filteredRows = computed(() => rows.value);
  const selectedRow = computed(() => rows.value.find((row, index) => tableRowKey(row, index) === selectedRowKey.value));
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
  const canUndoCurrentTableEdit = computed(() => csvEditHistory.canUndoCsvEdit(activeRoot.value, currentTab.value));
  const canRedoCurrentTableEdit = computed(() => csvEditHistory.canRedoCsvEdit(activeRoot.value, currentTab.value));
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

  function activateFor(modRoot: string, manifest?: ProjectManifest | null) {
    activeRoot.value = modRoot;
    const state = getActiveState();
    if (state && manifest) applyManifestSummaries(state, manifest);
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
    activeRoot.value = getNextActiveKeyAfterRemoval(activeRoot.value, [...stateMap.keys()], modRoot, '') ?? '';
  }

  function hasModDirtyChanges(modRoot: string): boolean {
    const state = stateMap.get(modRoot);
    if (!state) return false;
    return TABLE_KEYS.some((key) => Object.keys(state.dirty[key]).length > 0);
  }

  // --- Existing API ---

  function rowsFor(tab: TableKey): RowData[] {
    return getActiveState()?.tables[tab] ?? [];
  }

  function switchTab(tab: TableKey) {
    finishCellEdit();
    currentTab.value = tab;
    selectedRowKey.value = '';
    searchText.value = '';
    currentFaction.value = 'all';
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
    const mergedRows = mergeWindowRows(state.tables[table], rows, window.start);
    state.tables[table] = mergedRows;
    state.originalTables[table] = mergeWindowRows(state.originalTables[table], deepClone(rows), window.start);
  }

  function tableRowKey(row: RowData, index: number): string {
    return tableRowKeyForTab(currentTab.value, row, index);
  }

  function selectRowByKey(rowKey: string) {
    selectedRowKey.value = rowKey;
  }

  function isDirty(rowKey: string, col: string): boolean {
    return dirty.value[currentTab.value][rowKey]?.[col] !== undefined;
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
    const row = state.tables[tab].find((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
    if (!row) return;
    const previousValue = cell(row[col]);
    row[col] = value;
    const original = state.originalTables[tab].find((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
    const originalValue = cell(original?.[col]);
    if (value !== originalValue) {
      state.dirty[tab][rowKey] ||= {};
      state.dirty[tab][rowKey][col] = value;
    } else if (state.dirty[tab][rowKey]) {
      delete state.dirty[tab][rowKey][col];
      if (Object.keys(state.dirty[tab][rowKey]).length === 0) delete state.dirty[tab][rowKey];
    }
    state.editing = null;

    if (value !== previousValue) {
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
    return csvEditHistory.undoCsvEdit(activeRoot.value, currentTab.value, getActiveState());
  }

  function redoCurrentTableEdit(): boolean {
    return csvEditHistory.redoCsvEdit(activeRoot.value, currentTab.value, getActiveState());
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
    row._faction = 'other';

    row[TABLE_ROW_KEY_FIELD] = `${tab}:new:${Date.now()}`;
    state.tables[tab].push(row);
    const rowKey = tableRowKeyForTab(tab, row, state.tables[tab].length - 1);
    selectedRowKey.value = rowKey;
    markFullRowDirty(state, tab, row);

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

    const row = state.tables[tab].find((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
    if (!row) {
      state.selectedRowKey = '';
      return;
    }

    const rowIndex = state.tables[tab].findIndex((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
    const id = rowDisplayId(row) || `第 ${rowIndex + 1} 行`;
    state.tables[tab] = state.tables[tab].filter((r) => r !== row);
    if (rowKey) {
      const originalExists = state.originalTables[tab].some((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
      if (originalExists) {
        state.dirty[tab][rowKey] = { _deleted: 'true' };
      } else {
        delete state.dirty[tab][rowKey];
      }
    }
    state.selectedRowKey = '';

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
    state.dirty[tab][rowKey] = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith('_')) state.dirty[tab][rowKey][key] = cell(value);
    }
  }

  function getActiveModTableState(): ModTableState | undefined {
    return getActiveState();
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
      state.selectedRowKey = '';
      state.editing = null;
    }
  }

  function markTableSaved(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    state.originalTables[tab] = deepClone(state.tables[tab]);
    state.dirty[tab] = {};
  }

  function applySavedRowKeyMap(tab: TableKey, keyMap: Array<{ previousKey: string; nextKey: string }>) {
    const state = getActiveState();
    if (!state || keyMap.length === 0) return;
    const mapped = new Map(keyMap.map((item) => [item.previousKey, item.nextKey]));
    for (const row of state.tables[tab]) {
      const rowKey = cell(row[TABLE_ROW_KEY_FIELD]);
      const nextKey = mapped.get(rowKey);
      if (nextKey) row[TABLE_ROW_KEY_FIELD] = nextKey;
    }
    for (const row of state.originalTables[tab]) {
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
    currentTab,
    activeModRoot,
    canRedoCurrentTableEdit,
    canUndoCurrentTableEdit,
    dirty,
    editing,
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
    hasModDirtyChanges,
    hydrate,
    hydrateWithoutActivate,
    markTableSaved,
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
    applySavedRowKeyMap,
    applyTableWindow,
    tableRowKey,
    undoCurrentTableEdit,
    updateCellValueByKey,
  };
});

export { MODULE_LABELS };
