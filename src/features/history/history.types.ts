import type { RowData, TableKey } from '../../shared/types';

// --- Events ---

/** A single CSV cell was changed via finishCellEdit */
export interface CsvCellEditEvent {
  type: 'csv-cell-edit';
  tab: TableKey;
  rowKey: string;
  col: string;
  previousValue: string;
  newValue: string;
}

/** An editor (ship/weapon/projectile) was saved — one atomic event */
export interface EditorSaveEvent {
  type: 'editor-save';
  editorKind: 'ship' | 'weapon' | 'projectile';
  id: string;
  previousSpec: RowData;
  newSpec: RowData;
}

/** A config document was saved — one atomic event */
export interface ConfigSaveEvent {
  type: 'config-save';
  configKind: 'mod-info' | 'faction';
  id: string;
  previousData: RowData;
  newData: RowData;
}

/** A sprite path field was written in an editor */
export interface SpriteFieldWriteEvent {
  type: 'sprite-field-write';
  editorKind: 'ship' | 'weapon';
  id: string;
  field: string;
  previousValue: string;
  newValue: string;
}

export type HistoryEvent = CsvCellEditEvent | EditorSaveEvent | ConfigSaveEvent | SpriteFieldWriteEvent;

// --- Stack items ---

/** A reversible history entry */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  event: HistoryEvent;
  label: string;
}

/** Irreversible barrier — blocks undo traversal */
export interface HistoryBarrier {
  id: string;
  timestamp: number;
  kind: 'barrier';
  reason: 'row-create' | 'row-delete' | 'sprite-overwrite';
  label: string;
}

/** Save checkpoint — triggers trim but does not block undo */
export interface HistoryCheckpoint {
  id: string;
  timestamp: number;
  kind: 'checkpoint';
  source: 'csv-save' | 'editor-save' | 'config-save';
  label: string;
}

export type HistoryStackItem = HistoryEntry | HistoryBarrier | HistoryCheckpoint;

// --- Type guards ---

export function isEntry(item: HistoryStackItem): item is HistoryEntry {
  return 'event' in item;
}

export function isBarrier(item: HistoryStackItem): item is HistoryBarrier {
  return 'kind' in item && item.kind === 'barrier';
}

export function isCheckpoint(item: HistoryStackItem): item is HistoryCheckpoint {
  return 'kind' in item && item.kind === 'checkpoint';
}
