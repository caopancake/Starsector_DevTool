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
  factionFiles: Record<string, RowData>;
  missionCount: number;
  csvHeaders: Record<string, string[]>;
  csvPaths: Record<string, string>;
  ships: RowData[];
  weapons: RowData[];
  wings: RowData[];
  hullmods: RowData[];
  shipSystems: RowData[];
  industries: RowData[];
  skills: RowData[];
  abilities: RowData[];
  commodities: RowData[];
  shipFiles: Record<string, RowData>;
  variants: Record<string, RowData[]>;
  variantFiles: VariantFile[];
  skinFiles: SkinFile[];
  shipSprites: Record<string, string>;
  availableSprites: string[];
  wpnFiles: Record<string, RowData>;
  projFiles: Record<string, RowData>;
  systemFiles: Record<string, RowData>;
  skillFiles: Record<string, RowData>;
  weaponSprites: string[];
  weaponSpritesData: Record<string, Record<string, string>>;
  hullmodSprites: Record<string, string>;
  shipSystemSprites: Record<string, string>;
  industrySprites: Record<string, string>;
  skillSprites: Record<string, string>;
  abilitySprites: Record<string, string>;
  commoditySprites: Record<string, string>;
  coreReferences: CoreReferences;
}

export interface CoreReferences {
  tables: Partial<Record<TableKey, RowData[]>>;
  shipFiles: Record<string, RowData>;
  wpnFiles: Record<string, RowData>;
  variantFiles: VariantFile[];
  skinFiles: SkinFile[];
  shipSprites: Record<string, string>;
  weaponSpritesData: Record<string, Record<string, string>>;
  wingSprites: Record<string, string>;
  hullmodSprites: Record<string, string>;
  shipSystemSprites: Record<string, string>;
  industrySprites: Record<string, string>;
  skillSprites: Record<string, string>;
  abilitySprites: Record<string, string>;
  commoditySprites: Record<string, string>;
}

export interface VariantFile {
  variantId: string;
  hullId: string;
  path: string;
  relPath: string;
  data: RowData;
  weaponGroupCount: number;
  hullModCount: number;
  permaModCount: number;
  wingCount: number;
}

export interface SkinFile {
  skinHullId: string;
  baseHullId: string;
  path: string;
  relPath: string;
  data: RowData;
  builtInModCount: number;
  builtInWeaponCount: number;
  builtInWingCount: number;
  weaponSlotChangeCount: number;
  engineSlotChangeCount: number;
}

export interface GameScanWarning {
  path: string;
  message: string;
}

export interface GameModSummary {
  modRoot: string;
  id: string;
  name: string;
  version: string;
  description: string;
  hasModInfo: boolean;
}

export interface GameOverviewData {
  starsectorRoot: string;
  coreAvailable: boolean;
  modsDir: string;
  mods: GameModSummary[];
  warnings: GameScanWarning[];
}

export interface OpenDirectoryResult {
  kind: 'game-root' | 'mod-in-game' | 'external-mod' | 'unknown' | string;
  selectedPath: string;
  starsectorRoot?: string | null;
  modRoot?: string | null;
  overview?: GameOverviewData | null;
  warnings: GameScanWarning[];
}

export type TableKey = 'ships' | 'weapons' | 'wings' | 'hullmods' | 'shipSystems' | 'industries' | 'skills' | 'abilities' | 'commodities';
export type EditorKind = 'ship' | 'weapon' | 'projectile';

export interface SelectOption {
  label: string;
  value: string;
}

export type RenderFn = () => VNodeChild;

export type { ConfigView, ModEntry, ModTableState, PersistedMod, PersistedWorkspace, WorkspaceView } from '@/shared/types/workspace';
