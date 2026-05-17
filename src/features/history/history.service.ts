import type { AppData, ModTableState, RowData, TableKey } from '../../shared/types';
import { cell, deepClone } from '../../shared/lib/starsector';
import type { HistoryEntry } from './history.types';

/**
 * Apply the reversal of a history entry (undo direction).
 * Mutates tableState and/or modData in place.
 */
export function applyUndo(entry: HistoryEntry, tableState: ModTableState | undefined, modData: AppData | null): boolean {
  const event = entry.event;
  switch (event.type) {
    case 'csv-cell-edit':
      return applyCsvCellValue(tableState, event.tab, event.rowKey, event.col, event.previousValue);
    case 'editor-save':
      return applyEditorSpec(modData, event.editorKind, event.id, event.previousSpec);
    case 'config-save':
      return applyConfigData(modData, event.configKind, event.id, event.previousData);
    case 'sprite-field-write':
      return applyEditorField(modData, event.editorKind, event.id, event.field, event.previousValue);
  }
}

/**
 * Apply the redo direction of a history entry.
 * Mutates tableState and/or modData in place.
 */
export function applyRedo(entry: HistoryEntry, tableState: ModTableState | undefined, modData: AppData | null): boolean {
  const event = entry.event;
  switch (event.type) {
    case 'csv-cell-edit':
      return applyCsvCellValue(tableState, event.tab, event.rowKey, event.col, event.newValue);
    case 'editor-save':
      return applyEditorSpec(modData, event.editorKind, event.id, event.newSpec);
    case 'config-save':
      return applyConfigData(modData, event.configKind, event.id, event.newData);
    case 'sprite-field-write':
      return applyEditorField(modData, event.editorKind, event.id, event.field, event.newValue);
  }
}

// --- Internal helpers ---

function applyCsvCellValue(tableState: ModTableState | undefined, tab: TableKey, rowKey: string, col: string, value: string): boolean {
  if (!tableState) return false;
  const row = tableState.tables[tab].find((candidate, index) => resolveRowKey(tab, candidate, index) === rowKey);
  if (!row) return false;

  row[col] = value;

  // Sync dirty tracking
  const original = tableState.originalTables[tab].find((candidate, index) => resolveRowKey(tab, candidate, index) === rowKey);
  const originalValue = cell(original?.[col]);
  if (value !== originalValue) {
    tableState.dirty[tab][rowKey] ||= {};
    tableState.dirty[tab][rowKey][col] = value;
  } else if (tableState.dirty[tab][rowKey]) {
    delete tableState.dirty[tab][rowKey][col];
    if (Object.keys(tableState.dirty[tab][rowKey]).length === 0) {
      delete tableState.dirty[tab][rowKey];
    }
  }
  return true;
}

function applyEditorSpec(modData: AppData | null, kind: 'ship' | 'weapon' | 'projectile', id: string, spec: RowData): boolean {
  if (!modData) return false;
  const store = kind === 'ship' ? modData.shipFiles : kind === 'weapon' ? modData.wpnFiles : modData.projFiles;
  store[id] = deepClone(spec);
  return true;
}

function applyConfigData(modData: AppData | null, kind: 'mod-info' | 'faction', id: string, data: RowData): boolean {
  if (!modData) return false;
  if (kind === 'mod-info') {
    modData.modInfo = deepClone(data);
    return true;
  }
  modData.factionFiles[id] = deepClone(data);
  modData.factionMeta[id] = {
    name: cell(data.displayName) || cell(data.displayNameLong) || id,
    color: rgbaToCss(data.color),
  };
  return true;
}

function applyEditorField(modData: AppData | null, kind: 'ship' | 'weapon', id: string, field: string, value: string): boolean {
  if (!modData) return false;
  const store = kind === 'ship' ? modData.shipFiles : modData.wpnFiles;
  const spec = store[id];
  if (!spec) return false;
  spec[field] = value;
  return true;
}

function rgbaToCss(value: unknown): string {
  if (Array.isArray(value) && value.length >= 3) {
    const r = Math.round(Number(value[0]) || 0).toString();
    const g = Math.round(Number(value[1]) || 0).toString();
    const b = Math.round(Number(value[2]) || 0).toString();
    const a = Math.max(0, Math.min(255, Math.round(Number(value[3] ?? 255) || 0))) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return 'rgba(128, 128, 128, 1)';
}

/** Resolve row key — mirrors tables.store.ts tableRowKeyForTab */
function resolveRowKey(tab: TableKey, row: RowData, index: number): string {
  const existingKey = cell(row._rowKey);
  if (existingKey) return existingKey;
  const id = cell(row.id) || cell(row.hullId) || cell(row.name);
  return id ? `${tab}:id:${id}` : `${tab}:row:${index}`;
}
