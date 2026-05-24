import type { VNodeChild } from 'vue';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type RowData = Record<string, JsonValue>;

export interface FactionMeta {
  name: string;
  color: string;
}

export interface AppSettings {
  theme: string;
  accent: string;
  customAccent: string;
  historyLimit: number;
  editMode: string;
  starsectorRoot: string;
}

export interface ConfigFileEntityPayload {
  modRoot: string;
  previousId?: string | null;
  previousRelPath?: string | null;
  nextId: string;
  data: RowData;
}

export interface DiscoveredField {
  key: string;
  type: string;
  origin: string;
}

export type ProjectSessionId = string;

export interface SchemaRuntimeContext {
  modRoot: string;
  sessionId: ProjectSessionId;
}

export interface ProjectManifest {
  sessionId: ProjectSessionId;
  modRoot: string;
  starsectorRoot?: string | null;
  coreAvailable: boolean;
  modInfo: RowData;
  tableSummaries: Partial<Record<TableKey, TableSummary>>;
  entitySummaries: EntitySummaries;
  warnings: GameScanWarning[];
}

export interface TableSummary {
  path: string;
  header: string[];
  available: boolean;
  totalRows?: number | null;
}

export interface EntitySummaries {
  factions: number;
  missions: number;
  ships: number;
  weapons: number;
  projectiles: number;
  variants: number;
  skins: number;
  systems: number;
  skills: number;
}

export interface CsvTableWindow {
  table: TableKey;
  header: string[];
  totalRows: number;
  filteredRows: number;
  start: number;
  rows: CsvWindowRow[];
}

export interface CsvWindowRow {
  rowKey: string;
  rowIndex: number;
  row: RowData;
}

export interface SourceOptionGroup {
  label: string;
  options: SourceOption[];
}

export interface SourceOption {
  label: string;
  value: string;
  sprite?: string | null;
  resourceRef?: ResourceRef | null;
  origin: string;
}

export interface EntityData {
  kind: string;
  id: string;
  data: JsonValue;
  resourceRefs: Record<string, ResourceRef>;
}

export interface ResourceRef {
  source: 'mod' | 'core';
  relPath: string;
  ownerKind: string;
  ownerId: string;
  key: string;
}

export interface CsvRowPreview {
  resourceRef?: ResourceRef | null;
}

export interface ResourceDataUrlBatchEntry {
  key: string;
  source: string;
  relPath: string;
  dataUrl?: string | null;
}

export interface ResourceDataUrlBatchResult {
  entries: ResourceDataUrlBatchEntry[];
}

export interface HullReferenceOption {
  label: string;
  value: string;
  origin: string;
  kind: string;
  resourceRef?: ResourceRef | null;
  sprite?: string | null;
}

export interface HullReferenceGroup {
  label: string;
  options: HullReferenceOption[];
}

export interface HullReferencesResult {
  groups: HullReferenceGroup[];
  sprites: Record<string, ResourceRef>;
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

export type TableKey =
  | 'ships'
  | 'weapons'
  | 'wings'
  | 'hullmods'
  | 'shipSystems'
  | 'industries'
  | 'skills'
  | 'abilities'
  | 'commodities'
  | 'specialItems'
  | 'submarkets'
  | 'marketConditions'
  | 'simOpponents'
  | 'descriptions';
export type EditorKind = 'ship' | 'weapon' | 'projectile';

export interface SelectOption {
  label: string;
  value: string;
  sprite?: string;
  resourceRef?: ResourceRef | null;
}

export type RenderFn = () => VNodeChild;

export type { ConfigView, ModEntry, ModTableState, PersistedMod, PersistedWorkspace, WorkspaceView } from '@/shared/types/workspace.types';
export type { AppFeedback, ConfirmOptions } from '@/shared/types/feedback.types';
