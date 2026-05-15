import type { VNodeChild } from 'vue';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type RowData = Record<string, JsonValue>;

export interface FactionMeta {
  name: string;
  color: string;
}

export interface AppData {
  modRoot: string;
  starsectorRoot?: string;
  coreAvailable: boolean;
  modInfo: RowData;
  factionMeta: Record<string, FactionMeta>;
  csvHeaders: Record<string, string[]>;
  csvPaths: Record<string, string>;
  ships: RowData[];
  weapons: RowData[];
  wings: RowData[];
  hullmods: RowData[];
  industries: RowData[];
  shipFiles: Record<string, RowData>;
  variants: Record<string, RowData[]>;
  shipSprites: Record<string, string>;
  availableSprites: string[];
  wpnFiles: Record<string, RowData>;
  projFiles: Record<string, RowData>;
  weaponSprites: string[];
  weaponSpritesData: Record<string, Record<string, string>>;
  hullmodSprites: Record<string, string>;
  industrySprites: Record<string, string>;
}

export type TableKey = 'ships' | 'weapons' | 'wings' | 'hullmods' | 'industries';
export type EditorKind = 'ship' | 'weapon' | 'projectile' | 'preview';

export interface SelectOption {
  label: string;
  value: string;
}

export type RenderFn = () => VNodeChild;

export type { ModEditorState, ModEntry, ModTableState, WorkspaceView } from './workspace';
