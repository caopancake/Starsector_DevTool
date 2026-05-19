import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { AppData, ModTableState, RowData, TableKey } from '@/shared/types';
import { cell, deepClone, getColumns, MODULE_LABELS, rowDisplayId } from '@/shared/lib/starsector';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { assignTableRowKey, assignTableRowKeys, resolveTableRowKey } from '@/domain/tables/table-row-key';

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
  'submarkets',
  'marketConditions',
  'simOpponents',
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
    submarkets: {},
    marketConditions: {},
    simOpponents: {},
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
    submarkets: [],
    marketConditions: [],
    simOpponents: [],
  };
}

function createModTableState(): ModTableState {
  return {
    tables: emptyTablesRecord(),
    originalTables: emptyTablesRecord(),
    dirty: emptyDirtyState(),
    currentTab: 'ships',
    currentFaction: 'all',
    searchText: '',
    selectedRowKey: '',
    editing: null,
    nextRowKey: 0,
  };
}

export const useTablesStore = defineStore('tables', () => {
  const stateMap = reactive<Map<string, ModTableState>>(new Map());
  const activeRoot = ref('');
  const saving = ref(false);
  const currentHeaders = ref<string[]>([]);

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
    const headerColumns = getColumns(currentTab.value, currentHeaders.value);
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
  const filteredRows = computed(() => {
    const q = searchText.value.trim().toLowerCase();
    let list = [...rows.value];
    if (currentFaction.value !== 'all' && (currentTab.value === 'ships' || currentTab.value === 'weapons')) {
      list = list.filter((row) => cell(row._faction) === currentFaction.value);
    }
    if (q) {
      list = list.filter((row) => `${cell(row.id)} ${cell(row.name)}`.toLowerCase().includes(q));
    }
    return list;
  });
  const selectedRow = computed(() => rows.value.find((row, index) => tableRowKey(row, index) === selectedRowKey.value));
  const tableInfo = computed(() => `显示 ${filteredRows.value.length} / ${rows.value.length} 行`);
  const hasDirtyChanges = computed(() => TABLE_KEYS.some((key) => Object.keys(dirty.value[key]).length > 0));
  const hasChanges = computed(() => hasDirtyChanges.value || editing.value !== null);
  const activeModRoot = computed(() => activeRoot.value);

  // --- Per-Mod lifecycle ---

  function hydrate(modRoot: string, appData: AppData) {
    const state = createModTableState();
    for (const key of TABLE_KEYS) {
      state.tables[key] = deepClone(appData[key] as RowData[]);
      assignTableRowKeys(state, key, state.tables[key]);
      state.originalTables[key] = deepClone(state.tables[key]);
    }
    stateMap.set(modRoot, state);
    activateFor(modRoot, appData);
  }

  function hydrateWithoutActivate(modRoot: string, appData: AppData) {
    const state = createModTableState();
    for (const key of TABLE_KEYS) {
      state.tables[key] = deepClone(appData[key] as RowData[]);
      assignTableRowKeys(state, key, state.tables[key]);
      state.originalTables[key] = deepClone(state.tables[key]);
    }
    stateMap.set(modRoot, state);
  }

  function activateFor(modRoot: string, appData?: AppData | null) {
    activeRoot.value = modRoot;
    syncCurrentHeaders(appData ?? null);
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

  function syncCurrentHeaders(appData: AppData | null) {
    currentHeaders.value = appData?.csvHeaders[currentTab.value] || [];
  }

  function rowsFor(tab: TableKey): RowData[] {
    return getActiveState()?.tables[tab] ?? [];
  }

  function switchTab(tab: TableKey, appData: AppData | null) {
    finishCellEdit();
    currentTab.value = tab;
    selectedRowKey.value = '';
    searchText.value = '';
    currentFaction.value = 'all';
    syncCurrentHeaders(appData);
  }

  function tableRowKey(row: RowData, index: number): string {
    return tableRowKeyForTab(currentTab.value, row, index);
  }

  function rowSelectionKey(row: RowData): string {
    const index = rows.value.indexOf(row);
    return index >= 0 ? tableRowKey(row, index) : '';
  }

  function selectRow(row: RowData) {
    selectedRowKey.value = rowSelectionKey(row);
  }

  function isDirty(rowKey: string, col: string): boolean {
    return dirty.value[currentTab.value][rowKey]?.[col] !== undefined;
  }

  function startCellEdit(row: RowData, col: string) {
    editing.value = { tab: currentTab.value, rowKey: rowSelectionKey(row), col, value: cell(row[col]) };
  }

  function finishCellEdit() {
    const state = getActiveState();
    if (!state || !state.editing) return;
    const { tab, rowKey, col, value } = state.editing;
    const row = state.tables[tab].find((candidate, index) => tableRowKeyForTab(tab, candidate, index) === rowKey);
    if (!row) {
      state.editing = null;
      return;
    }
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

    // Push to global history if value actually changed
    if (value !== previousValue) {
      const csvEditHistory = useTablesEditHistoryStore();
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

  function revertChanges() {
    const state = getActiveState();
    if (!state) return;
    state.editing = null;
    for (const key of TABLE_KEYS) {
      state.tables[key] = deepClone(state.originalTables[key]);
      state.dirty[key] = {};
    }
  }

  async function addNewRow(appData: AppData) {
    const state = getActiveState();
    if (!state) return;
    const tab = state.currentTab;
    const id = `new_${tab}_${Date.now()}`;
    const header = appData.csvHeaders[tab];
    const row: RowData = {};
    for (const col of header) row[col] = '';
    if ('id' in row) row.id = id;
    if ('name' in row) row.name = id;
    row._faction = 'other';

    state.tables[tab].push(row);
    assignTableRowKey(state, tab, row);
    selectedRowKey.value = rowSelectionKey(row);
    markFullRowDirty(state, tab, row);

    const csvEditHistory = useTablesEditHistoryStore();
    csvEditHistory.pushCsvEditEvent(
      activeRoot.value,
      tab,
      { type: 'row-create', tab, rowKey: rowSelectionKey(row), rowIndex: state.tables[tab].length - 1, row: deepClone(row) },
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

    const csvEditHistory = useTablesEditHistoryStore();
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
    assignTableRowKeys(state, tab, state.tables[tab]);
    state.originalTables[tab] = deepClone(state.tables[tab]);
    state.dirty[tab] = {};
  }

  function markTableSaved(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    state.originalTables[tab] = deepClone(state.tables[tab]);
    state.dirty[tab] = {};
  }

  function setSaving(value: boolean) {
    saving.value = value;
  }

  return {
    currentFaction,
    currentTab,
    activeModRoot,
    dirty,
    editing,
    filteredRows,
    hasChanges,
    hasDirtyChanges,
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
    revertChanges,
    rowSelectionKey,
    rowsFor,
    selectRow,
    setSaving,
    startCellEdit,
    switchTab,
    tableRowKey,
  };
});

export { MODULE_LABELS };
