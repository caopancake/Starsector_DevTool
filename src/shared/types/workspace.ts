import type { RowData, TableKey } from './index';

/** Metadata for one imported Mod in the workspace */
export interface ModEntry {
  modRoot: string;
  displayName: string;
  version: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

/** Per-Mod table state — fully isolated from other Mods */
export interface ModTableState {
  tables: Record<TableKey, RowData[]>;
  originalTables: Record<TableKey, RowData[]>;
  dirty: Record<TableKey, Record<string, Record<string, string>>>;
  currentTab: TableKey;
  currentFaction: string;
  searchText: string;
  selectedRowKey: string;
  editing: { tab: TableKey; rowKey: string; col: string; value: string } | null;
}

/** Per-Mod editor state */
export interface ModEditorState {
  shipEditorId: string;
  weaponEditorId: string;
  projectileEditorId: string;
  previewWeaponId: string;
}

/** Which main-content view is shown */
export type WorkspaceView = 'overview' | 'table' | 'settings';
