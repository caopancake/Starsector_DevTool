import type { GameModSummary, GameScanWarning, RowData, TableKey } from './index';

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
  nextRowKey: number; // Per-mod row key counter to prevent collisions
}

/** Which main-content view is shown */
export type WorkspaceView = 'overview' | 'table' | 'settings' | 'config';

/** Which config sub-view is shown when currentView === 'config' */
export type ConfigView = 'mod-overview' | 'file-history' | 'mod-info' | 'factions' | 'variants' | 'mission';

/** Persisted mod entry (stored to disk) */
export interface PersistedMod {
  modRoot: string;
  displayName: string;
  version: string;
}

/** Persisted workspace state (stored to disk via Rust backend) */
export interface PersistedWorkspace {
  mods: PersistedMod[];
  activeModRoot: string | null;
  currentView: string | null;
  expandedMods: string[];
  starsectorRoot?: string | null;
  gameMods?: GameModSummary[];
  gameWarnings?: GameScanWarning[];
}
