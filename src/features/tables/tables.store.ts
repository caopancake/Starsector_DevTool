import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { AppData, ModTableState, RowData, TableKey } from '../../shared/types';
import { cell, deepClone, defaultShip, defaultWeapon, getColumns, MODULE_LABELS, rowId } from '../../shared/lib/starsector';
import {
  createShipRecord,
  createTableRow,
  createWeaponRecord,
  removeShipRecord,
  removeTableRow,
  removeWeaponRecord,
  saveTableRows,
} from './table.service';

export const TABLE_KEYS: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'industries'];
const ROW_KEY_FIELD = '_rowKey';
let nextRowKey = 0;

function emptyDirtyState(): Record<TableKey, Record<string, Record<string, string>>> {
  return { ships: {}, weapons: {}, wings: {}, hullmods: {}, industries: {} };
}

function emptyTablesRecord(): Record<TableKey, RowData[]> {
  return { ships: [], weapons: [], wings: [], hullmods: [], industries: [] };
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
  };
    nextRowKey: 0,
}

export const useTablesStore = defineStore('tables', () => {
  const stateMap = reactive<Map<string, ModTableState>>(new Map());
  const activeRoot = ref('');
  const saving = ref(false);
  const currentHeaders = ref<string[]>([]);

  function getActiveState(): ModTableState | undefined {
    return stateMap.get(activeRoot.value);
  }

  // --- Proxy computed/refs for backward-compatible API ---

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
  const selectedRowId = computed(() => (selectedRow.value ? rowId(selectedRow.value) : ''));
  const tableInfo = computed(() => `显示 ${filteredRows.value.length} / ${rows.value.length} 行`);
  const hasDirtyChanges = computed(() => TABLE_KEYS.some((key) => Object.keys(dirty.value[key]).length > 0));
  const hasChanges = computed(() => hasDirtyChanges.value || editing.value !== null);

  // --- Per-Mod lifecycle ---

  function hydrate(modRoot: string, appData: AppData) {
    const state = createModTableState();
    for (const key of TABLE_KEYS) {
      state.tables[key] = deepClone(appData[key] as RowData[]);
      assignRowKeys(key, state.tables[key]);
      state.originalTables[key] = deepClone(state.tables[key]);
    }
    stateMap.set(modRoot, state);
    activateFor(modRoot);
    syncCurrentHeaders(appData);
  }


  function activateFor(modRoot: string, appData?: AppData | null) {
    activeRoot.value = modRoot;
    const state = stateMap.get(modRoot);
    if (state) {
      state.selectedRowKey = '';
      state.searchText = '';
    }
    syncCurrentHeaders(appData ?? null);
  }
  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
    if (activeRoot.value === modRoot) {
      const remaining = [...stateMap.keys()];
      activeRoot.value = remaining[0] ?? '';
    }
  }

  function hasModDirtyChanges(modRoot: string): boolean {
    const state = stateMap.get(modRoot);
    if (!state) return false;
    return TABLE_KEYS.some((key) => Object.keys(state.dirty[key]).length > 0);
  }

  // --- Existing API (unchanged signatures where possible) ---

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
  }

  function cancelCellEdit() {
    editing.value = null;
  }

  async function saveChanges(appData: AppData | null): Promise<'saved' | 'noop'> {
    const capturedModRoot = activeRoot.value;
    const state = stateMap.get(capturedModRoot);
    
    if (!appData || !state || saving.value) return 'noop';
    
    if (appData.modRoot !== capturedModRoot) {
      console.warn(`AppData mismatch: expected ${capturedModRoot}, got ${appData.modRoot}`);
      return 'noop';
    }
    
    saving.value = true;
    try {
      finishCellEdit();
      if (!hasDirtyChanges.value) return 'noop';
      for (const key of TABLE_KEYS) {
        if (Object.keys(state.dirty[key]).length === 0) continue;
        await saveTableRows(capturedModRoot, key, appData.csvHeaders[key], state.tables[key]);
        state.originalTables[key] = deepClone(state.tables[key]);
        state.dirty[key] = {};
      }
      return 'saved';
    } finally {
      saving.value = false;
    }
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
    const state = getActiveState();
    if (!state) {
      console.error('Table not ready for new row');
      return;
    }
    const tab = state.currentTab;
    const id = `new_${tab}_${Date.now()}`;
    const header = appData.csvHeaders[tab];
    const row: RowData = {};
    for (const col of header) row[col] = '';
    if ('id' in row) row.id = id;
    if ('name' in row) row.name = id;
    row._faction = 'other';

    if (tab === 'ships') {
      const ship = defaultShip(id);
      await createShipRecord(appData.modRoot, header, row, ship);
      appData.shipFiles[id] = ship;
    } else if (tab === 'weapons') {
      const weapon = defaultWeapon(id, row);
      await createWeaponRecord(appData.modRoot, header, row, weapon);
      appData.wpnFiles[id] = weapon;
    } else {
      await createTableRow(appData.modRoot, tab, header, row);
    }

    state.tables[tab].push(row);
    assignRowKey(tab, row);
    state.originalTables[tab].push(deepClone(row));
    selectedRowKey.value = rowSelectionKey(row);
  }

  async function deleteSelected(appData: AppData) {
    const state = getActiveState();
    if (!state) return;
    const tab = state.currentTab;
    const id = selectedRowId.value;
    if (!id) return;

    if (tab === 'ships') {

    const row = state.tables[tab].find(r => rowId(r) === id);
    if (!row) {
      console.warn(`Row not found in current table`);
      state.selectedRowKey = '';
      return;
    }
      await removeShipRecord(appData.modRoot, id);
      delete appData.shipFiles[id];
      delete appData.shipSprites[id];
    } else if (tab === 'weapons') {
      await removeWeaponRecord(appData.modRoot, id);
      delete appData.wpnFiles[id];
    } else {
      await removeTableRow(appData.modRoot, tab, id);
    }

    state.tables[tab] = state.tables[tab].filter((row) => rowId(row) !== id);
    state.originalTables[tab] = state.originalTables[tab].filter((row) => rowId(row) !== id);
    const rowKey = state.selectedRowKey;
    if (rowKey) delete state.dirty[tab][rowKey];
    state.selectedRowKey = '';
  }

  function assignRowKeys(tab: TableKey, list: RowData[]) {
    for (const row of list) {
      assignRowKey(tab, row);
    }
  }


  function assignRowKey(tab: TableKey, row: RowData) {
    if (!cell(row[ROW_KEY_FIELD])) {
      const state = getActiveState();
      if (state) {
        row[ROW_KEY_FIELD] = `${tab}:rowKey:${state.nextRowKey++}`;
      }
    }
  }
  function tableRowKeyForTab(tab: TableKey, row: RowData, index: number): string {
    const existingKey = cell(row[ROW_KEY_FIELD]);
    if (existingKey) return existingKey;
    const id = rowId(row);
    return id ? `${tab}:id:${id}` : `${tab}:row:${index}`;
  }

  return {
    currentFaction,
    currentTab,
    dirty,
    editing,
    filteredRows,
    hasChanges,
    isDirty,
    rows,
    saving,
    searchText,
    selectedRow,
    selectedRowId,
    selectedRowKey,
    tableInfo,
    tables,
    visibleColumns,
    activateFor,
    addNewRow,
    cancelCellEdit,
    deleteSelected,
    finishCellEdit,
    hasModDirtyChanges,
    hydrate,
    removeModState,
    revertChanges,
    rowSelectionKey,
    rowsFor,
    saveChanges,
    selectRow,
    startCellEdit,
    switchTab,
    tableRowKey,
  };
});

export { MODULE_LABELS };
