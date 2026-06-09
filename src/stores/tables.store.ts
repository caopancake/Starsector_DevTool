import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import {
  TABLE_KEYS,
  type CsvRowKeyMapping,
  type CsvTableRows,
  type CsvTableWindow,
  type ModTableState,
  type ProjectManifest,
  type RowData,
  type TableKey,
} from '@/shared/types';
import { getColumns, MODULE_LABELS } from '@/shared/lib/starsector';
import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';
import { csvDirtyCells } from '@/domain/tables/csv-dirty';
import { DEFAULT_CSV_FACTION_FILTER, filterFromOptionValue, filterOptionValue } from '@/domain/tables/csv-faction-filter';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import {
  applyCsvTableWindowDraft,
  applySavedCsvRowKeyMapDraft,
  cancelCsvCellEditDraft,
  clearCsvTableExternalUpdateDraft,
  createCsvRowDraft,
  csvTableRowKey,
  deleteSelectedCsvRowDraft,
  discardCsvTableWindowForReloadDraft,
  finishCsvCellEditDraft,
  hasCsvTableDraftChanges,
  markCsvTableExternalUpdateDraft,
  markCsvTableSavedDraft,
  replaceCsvTableDraft,
  setCsvCellValueDraft,
  setCsvEditingValueDraft,
  startCsvCellEditDraft,
  type CsvDraftResult,
} from '@/domain/tables/csv-table-draft';
import { isLoadedCsvTableRow } from '@/domain/tables/csv-table-rows';

function emptyDirtyState(): ModTableState['dirty'] {
  return emptyTableRecord(() => ({}));
}

function emptyExternalUpdateState(): Record<TableKey, boolean> {
  return emptyTableRecord(() => false);
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
    pendingExternalTableUpdates: emptyExternalUpdateState(),
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
    get: () => filterOptionValue(currentFaction.value),
    set: (v) => {
      currentFaction.value = filterFromOptionValue(v);
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
  const hasCurrentTableExternalUpdate = computed(() => {
    const state = getActiveState();
    return state ? state.pendingExternalTableUpdates[state.currentTab] : false;
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
    applyCsvTableWindowDraft(state, window);
  }

  function hasTableDirtyChanges(tab: TableKey): boolean {
    const state = getActiveState();
    if (!state) return false;
    return hasCsvTableDraftChanges(state, tab);
  }

  function markTableExternalUpdate(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    markCsvTableExternalUpdateDraft(state, tab);
  }

  function clearTableExternalUpdate(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    clearCsvTableExternalUpdateDraft(state, tab);
  }

  function tableRowKey(row: RowData, index: number): string {
    return csvTableRowKey(currentTab.value, row, index);
  }

  function selectRowByKey(rowKey: string | null) {
    selectedRowKey.value = rowKey;
  }

  function isDirty(rowKey: string, col: string): boolean {
    return csvDirtyCells(dirty.value[currentTab.value][rowKey])?.[col] !== undefined;
  }

  function startCellEditByKey(rowKey: string, col: string, value: string) {
    const state = getActiveState();
    if (state) startCsvCellEditDraft(state, rowKey, col, value);
  }

  function setEditingValue(value: string) {
    const state = getActiveState();
    if (state) setCsvEditingValueDraft(state, value);
  }

  function finishCellEdit() {
    const state = getActiveState();
    if (!state) return;
    pushCsvDraftResult(state.currentTab, finishCsvCellEditDraft(state));
  }

  function updateCellValueByKey(rowKey: string, col: string, value: string) {
    const state = getActiveState();
    if (!state) return;
    pushCsvDraftResult(state.currentTab, setCsvCellValueDraft(state, state.currentTab, rowKey, col, value));
  }

  function cancelCellEdit() {
    const state = getActiveState();
    if (state) cancelCsvCellEditDraft(state);
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
    pushCsvDraftResult(state.currentTab, createCsvRowDraft(state, Date.now()));
  }

  async function deleteSelected() {
    const state = getActiveState();
    if (!state) return;
    pushCsvDraftResult(state.currentTab, deleteSelectedCsvRowDraft(state));
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
    replaceCsvTableDraft(state, tab, rows);
  }

  function discardTableDraftForReload(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    discardCsvTableWindowForReloadDraft(state, tab);
  }

  function loadExternalTableDraft(tab: TableKey) {
    const state = getActiveState();
    if (!state) return;
    discardCsvTableWindowForReloadDraft(state, tab);
  }

  function markTableSavedForMod(modRoot: string, tab: TableKey) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    markCsvTableSavedDraft(state, tab);
  }

  function applySavedRowKeyMapForMod(modRoot: string, tab: TableKey, keyMap: CsvRowKeyMapping[]) {
    const state = stateMap.get(modRoot);
    if (!state) return;
    applySavedCsvRowKeyMapDraft(state, tab, keyMap);
  }

  function pushCsvDraftResult(table: TableKey, result: CsvDraftResult) {
    if (!activeRoot.value || !result.historyOperation || !result.historyLabel) return;
    csvEditHistory.pushCsvDraftOperation(activeRoot.value, table, result.historyOperation, result.historyLabel);
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
    hasCurrentTableExternalUpdate,
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
    loadExternalTableDraft,
    hasModDirtyChanges,
    hydrate,
    hydrateWithoutActivate,
    markTableSavedForMod,
    markTableExternalUpdate,
    removeModState,
    replaceTableForMod,
    discardTableDraftForReload,
    redoCurrentTableEdit,
    rowsFor,
    selectRowByKey,
    setSaving,
    clearTableExternalUpdate,
    startCellEditByKey,
    setEditingValue,
    switchTab,
    applySavedRowKeyMapForMod,
    applyTableWindow,
    hasTableDirtyChanges,
    tableRowKey,
    undoCurrentTableEdit,
    updateCellValueByKey,
  };
});

export { MODULE_LABELS };
