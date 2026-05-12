import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { AppData, RowData, TableKey } from '../../shared/types';
import { cell, deepClone, defaultShip, getColumns, MODULE_LABELS, rowId } from '../../shared/lib/starsector';
import { createShipSpec, createTableRow, removeShipSpec, removeTableRow, saveTableRows } from './table.service';

type DirtyState = Record<TableKey, Record<string, Record<string, string>>>;
type EditingCell = { tab: TableKey; id: string; col: string; value: string } | null;

export const TABLE_KEYS: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'industries'];

export const useTablesStore = defineStore('tables', () => {
  const tables = reactive<Record<TableKey, RowData[]>>({ ships: [], weapons: [], wings: [], hullmods: [], industries: [] });
  const originalTables = reactive<Record<TableKey, RowData[]>>({ ships: [], weapons: [], wings: [], hullmods: [], industries: [] });
  const dirty = reactive<DirtyState>({ ships: {}, weapons: {}, wings: {}, hullmods: {}, industries: {} });
  const currentTab = ref<TableKey>('ships');
  const currentFaction = ref('all');
  const searchText = ref('');
  const selectedRowKey = ref('');
  const editing = ref<EditingCell>(null);
  const saving = ref(false);

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
  const hasDirtyChanges = computed(() => TABLE_KEYS.some((key) => Object.keys(dirty[key]).length > 0));
  const hasChanges = computed(() => hasDirtyChanges.value || editing.value !== null);
  const currentHeaders = ref<string[]>([]);

  function hydrate(appData: AppData) {
    for (const key of TABLE_KEYS) {
      tables[key] = deepClone(appData[key] as RowData[]);
      originalTables[key] = deepClone(tables[key]);
      dirty[key] = {};
    }
    currentTab.value = 'ships';
    currentFaction.value = 'all';
    searchText.value = '';
    selectedRowKey.value = '';
    editing.value = null;
    syncCurrentHeaders(appData);
  }

  function syncCurrentHeaders(appData: AppData | null) {
    currentHeaders.value = appData?.csvHeaders[currentTab.value] || [];
  }

  function rowsFor(tab: TableKey): RowData[] {
    return tables[tab];
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
    const id = rowId(row);
    return id ? `${currentTab.value}:id:${id}` : `${currentTab.value}:row:${index}`;
  }

  function rowSelectionKey(row: RowData): string {
    const index = rows.value.indexOf(row);
    return index >= 0 ? tableRowKey(row, index) : '';
  }

  function selectRow(row: RowData) {
    selectedRowKey.value = rowSelectionKey(row);
  }

  function isDirty(id: string, col: string): boolean {
    return dirty[currentTab.value][id]?.[col] !== undefined;
  }

  function startCellEdit(row: RowData, col: string) {
    editing.value = { tab: currentTab.value, id: rowId(row), col, value: cell(row[col]) };
  }

  function finishCellEdit() {
    if (!editing.value) return;
    const { tab, id, col, value } = editing.value;
    const row = rowsFor(tab).find((candidate) => rowId(candidate) === id);
    if (!row) {
      editing.value = null;
      return;
    }
    row[col] = value;
    const original = originalTables[tab].find((candidate) => rowId(candidate) === id);
    const originalValue = cell(original?.[col]);
    if (value !== originalValue) {
      dirty[tab][id] ||= {};
      dirty[tab][id][col] = value;
    } else if (dirty[tab][id]) {
      delete dirty[tab][id][col];
      if (Object.keys(dirty[tab][id]).length === 0) delete dirty[tab][id];
    }
    editing.value = null;
  }

  function cancelCellEdit() {
    editing.value = null;
  }

  async function saveChanges(appData: AppData | null): Promise<'saved' | 'noop'> {
    if (!appData || saving.value) return 'noop';
    saving.value = true;
    try {
      finishCellEdit();
      if (!hasDirtyChanges.value) return 'noop';
      for (const key of TABLE_KEYS) {
        if (Object.keys(dirty[key]).length === 0) continue;
        await saveTableRows(appData.modRoot, key, appData.csvHeaders[key], rowsFor(key));
        originalTables[key] = deepClone(rowsFor(key));
        dirty[key] = {};
      }
      return 'saved';
    } finally {
      saving.value = false;
    }
  }

  function revertChanges() {
    editing.value = null;
    for (const key of TABLE_KEYS) {
      tables[key] = deepClone(originalTables[key]);
      dirty[key] = {};
    }
  }

  async function addNewRow(appData: AppData) {
    const tab = currentTab.value;
    const id = `new_${tab}_${Date.now()}`;
    const header = appData.csvHeaders[tab];
    const row: RowData = {};
    for (const col of header) row[col] = '';
    if ('id' in row) row.id = id;
    if ('name' in row) row.name = id;
    row._faction = 'other';
    rowsFor(tab).push(row);
    originalTables[tab].push(deepClone(row));
    await createTableRow(appData.modRoot, tab, header, row);
    if (tab === 'ships') {
      const ship = defaultShip(id);
      appData.shipFiles[id] = ship;
      await createShipSpec(appData.modRoot, id, ship);
    }
    selectedRowKey.value = rowSelectionKey(row);
  }

  async function deleteSelected(appData: AppData) {
    const tab = currentTab.value;
    const id = selectedRowId.value;
    if (!id) return;
    tables[tab] = rowsFor(tab).filter((row) => rowId(row) !== id);
    originalTables[tab] = originalTables[tab].filter((row) => rowId(row) !== id);
    delete dirty[tab][id];
    await removeTableRow(appData.modRoot, tab, id);
    if (tab === 'ships') {
      delete appData.shipFiles[id];
      delete appData.shipSprites[id];
      await removeShipSpec(appData.modRoot, id);
    }
    selectedRowKey.value = '';
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
    addNewRow,
    cancelCellEdit,
    deleteSelected,
    finishCellEdit,
    hydrate,
    revertChanges,
    rowId,
    rowSelectionKey,
    rowsFor,
    saveChanges,
    selectRow,
    startCellEdit,
    switchTab,
    syncCurrentHeaders,
    tableRowKey,
  };
});

export { MODULE_LABELS };
