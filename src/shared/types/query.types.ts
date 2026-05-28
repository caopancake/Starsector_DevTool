import type { JsonValue, RowData } from '@/shared/types/json.types';
import type { TableKey } from '@/shared/types/tables.types';

export interface DiscoveredField {
  key: string;
  type: DiscoveredFieldType;
  origin: ResourceSource;
}

export type DiscoveredFieldType =
  | 'boolean'
  | 'integer'
  | 'float'
  | 'string'
  | 'path-image'
  | 'string-array'
  | 'color-rgba'
  | 'array-of-object'
  | 'tag-select'
  | 'object';

export type ProjectSessionId = string;

export interface SchemaRuntimeContext {
  modRoot: string;
  sessionId: ProjectSessionId;
  querySourceOptions?: (source: string, currentValues: string[], search?: string, limit?: number) => Promise<HydratedSourceOptionGroup[]>;
}

export interface ProjectManifest {
  sessionId: ProjectSessionId;
  modRoot: string;
  starsectorRoot: string | null;
  coreAvailable: boolean;
  modInfo: RowData;
  tableSummaries: Record<TableKey, TableSummary>;
  tableEntitySummaries: Record<TableKey, number>;
  entitySummaries: EntitySummaries;
  warnings: GameScanWarning[];
}

export interface TableSummary {
  path: string;
  header: string[];
  available: boolean;
  totalRows: number | null;
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

export interface SourceOptionGroup {
  label: string;
  options: SourceOption[];
}

export interface SourceOption {
  label: string;
  value: string;
  description: string | null;
  resourceRef: ResourceRef | null;
  origin: SourceOptionOrigin;
}

export interface HydratedSourceOption extends SourceOption {
  sprite: string;
}

export interface HydratedSourceOptionGroup {
  label: string;
  options: HydratedSourceOption[];
}

export interface EntityData {
  kind: EntityKind;
  id: string;
  data: JsonValue;
  resourceRefs: Record<string, ResourceRef>;
}

export type EntityKind = 'ship' | 'weapon' | 'projectile' | 'system' | 'skill' | 'faction' | 'mission' | 'variant' | 'skin';
export const RESOURCE_SOURCES = ['mod', 'core'] as const;
export type ResourceSource = (typeof RESOURCE_SOURCES)[number];
export type SourceOptionOrigin = 'current' | ResourceSource;
export const RESOURCE_OWNER_KINDS = [
  'ship',
  'weapon',
  'variant',
  'skin',
  'faction',
  'mission',
  'hullmods',
  'shipSystems',
  'industries',
  'skills',
  'abilities',
  'commodities',
  'specialItems',
  'submarkets',
  'marketConditions',
] as const;
export type ResourceOwnerKind = (typeof RESOURCE_OWNER_KINDS)[number];

export interface ResourceRef {
  source: ResourceSource;
  relPath: string;
  ownerKind: ResourceOwnerKind;
  ownerId: string;
  key: string;
}

export interface ResourceDataUrlBatchEntry {
  key: string;
  source: ResourceSource;
  relPath: string;
  ownerKind: ResourceOwnerKind;
  ownerId: string;
  dataUrl: string | null;
}

export interface ResourceDataUrlBatchResult {
  entries: ResourceDataUrlBatchEntry[];
}

export interface HullReferenceOption {
  label: string;
  value: string;
  origin: ResourceSource;
  kind: HullReferenceKind;
  resourceRef: ResourceRef | null;
}

export type HullReferenceKind = 'ship' | 'skin';

export interface HullReferenceGroup {
  label: string;
  options: HullReferenceOption[];
}

export interface HullReferencesResult {
  groups: HullReferenceGroup[];
  sprites: Record<string, ResourceRef>;
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

export type OpenDirectoryKind = 'game-root' | 'mod-in-game' | 'external-mod' | 'unknown';

export interface OpenDirectoryResult {
  kind: OpenDirectoryKind;
  selectedPath: string;
  starsectorRoot: string | null;
  modRoot: string | null;
  overview: GameOverviewData | null;
  warnings: GameScanWarning[];
}
