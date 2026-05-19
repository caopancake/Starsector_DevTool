import type { AppData, CoreReferences, JsonValue, RowData, TableKey } from '@/shared/types';
import type { DiscoveredField, FieldSchema, FileSchema, SectionSchema } from '@/domain/schema/schema.types';
import { isDisabledCsvReference } from '@/shared/lib/starsector';
import { hullReferenceRows, hullSpriteMap, wingSpriteMap } from '@/shared/lib/hull-references';

import modInfoSchemaRaw from '../../../schemas/mod-info.schema.json';
import factionSchemaRaw from '../../../schemas/faction.schema.json';
import missionSchemaRaw from '../../../schemas/mission.schema.json';
import skinSchemaRaw from '../../../schemas/skin.schema.json';
import variantSchemaRaw from '../../../schemas/variant.schema.json';

const SCHEMAS: Record<string, FileSchema> = {
  'mod-info': modInfoSchemaRaw as unknown as FileSchema,
  faction: factionSchemaRaw as unknown as FileSchema,
  mission: missionSchemaRaw as unknown as FileSchema,
  skin: skinSchemaRaw as unknown as FileSchema,
  variant: variantSchemaRaw as unknown as FileSchema,
};

/**
 * Retrieve a schema by id. Returns null if not found.
 */
export function getSchema(id: string): FileSchema | null {
  return SCHEMAS[id] ?? null;
}

/**
 * Normalize a schema into sections.
 * If the schema already has `sections`, returns them.
 * Otherwise wraps the flat `fields` array into a single default section.
 */
export function getSections(schema: FileSchema): SectionSchema[] {
  if (schema.sections && schema.sections.length > 0) {
    return schema.sections;
  }
  if (schema.fields && schema.fields.length > 0) {
    return [{ id: '__all', label: schema.displayName ?? '所有字段', fields: schema.fields }];
  }
  return [];
}

/**
 * Collect all top-level field keys defined by a schema.
 */
export function getSchemaKeys(schema: FileSchema): string[] {
  const sections = getSections(schema);
  const keys: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      keys.push(field.key);
    }
  }
  return keys;
}

export function isMultiSourceSchema(schema: FileSchema): boolean {
  return Boolean(schema.sources?.length);
}

export function getExtraFieldSource(schema: FileSchema): string | null {
  return schema.sources?.find((source) => source.extraFields)?.id ?? null;
}

export function aggregateSchemaSources(sources: Record<string, unknown>): RowData {
  const result: RowData = {};
  for (const [sourceId, value] of Object.entries(sources)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[sourceId] = value as RowData;
    } else {
      result[sourceId] = { content: scalarToJsonValue(value) };
    }
  }
  return result;
}

function scalarToJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function splitSchemaSources(model: RowData, schema: FileSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of schema.sources ?? []) {
    const value = model[source.id];
    if (source.type === 'text-file') {
      result[source.id] =
        value && typeof value === 'object' && !Array.isArray(value) ? ((value as Record<string, unknown>).content ?? '') : '';
    } else {
      result[source.id] = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
  }
  return result;
}

export interface SelectOption {
  label: string;
  value: string;
  sprite?: string; // data URL for thumbnail preview
  type?: 'group';
  children?: SelectOption[];
}

/**
 * Resolve a `source` descriptor to a list of options using appData.
 *
 * Supported formats:
 * - "csv:ships.tags" → extract unique comma-separated tags from ships rows
 * - "csv:weapons.id" → extract unique id values from weapons rows
 * - "enum:A,B,C"     → static enum values
 */
export function resolveSource(source: string | undefined | null, appData: AppData | null): SelectOption[] {
  if (!source || !appData) return [];

  // "csv:table.column"
  if (source.startsWith('csv:')) {
    const rest = source.slice(4);
    const dotIdx = rest.indexOf('.');
    const table = dotIdx > 0 ? rest.slice(0, dotIdx) : rest;
    const col = dotIdx > 0 ? rest.slice(dotIdx + 1) : 'id';

    const modRows = table === 'ships' ? hullReferenceRows(appData, 'mod') : rowsForTable(appData, table);
    const coreRows = table === 'ships' ? hullReferenceRows(appData, 'core') : coreRowsForTable(appData.coreReferences, table);
    if (modRows.length === 0 && coreRows.length === 0) return [];

    if (col === 'tags') {
      return groupedOptions(tagOptions(modRows), tagOptions(coreRows));
    } else {
      return groupedOptions(entityOptions(appData, table, col, modRows, 'mod'), entityOptions(appData, table, col, coreRows, 'core'));
    }
  }

  // "enum:A,B,C"
  if (source.startsWith('enum:')) {
    return source
      .slice(5)
      .split(',')
      .map((v) => ({ label: v.trim(), value: v.trim() }));
  }

  return [];
}

/**
 * Get the sprite map for a given table from AppData.
 * Returns a map from id → data URL string (or undefined if no sprites for this table).
 */
function getSpriteMap(appData: AppData, table: string): Record<string, string> | undefined {
  switch (table) {
    case 'ships':
      return hullSpriteMap(appData, 'mod');
    case 'hullmods':
      return appData.hullmodSprites;
    case 'weapons':
      return flattenWeaponSprites(appData.weaponSpritesData);
    case 'wings':
      return wingSpriteMap(appData, appData.wings, appData.variantFiles, 'mod');
    case 'shipSystems':
      return appData.shipSystemSprites;
    case 'industries':
      return appData.industrySprites;
    case 'skills':
      return appData.skillSprites;
    case 'abilities':
      return appData.abilitySprites;
    case 'commodities':
      return appData.commoditySprites;
    default:
      return undefined;
  }
}

function getCoreSpriteMap(appData: AppData, table: string): Record<string, string> | undefined {
  const core = appData.coreReferences;
  switch (table) {
    case 'ships':
      return hullSpriteMap(appData, 'core');
    case 'weapons':
      return flattenWeaponSprites(core.weaponSpritesData);
    case 'wings':
      return wingSpriteMap(appData, core.tables.wings ?? [], core.variantFiles, 'core');
    case 'hullmods':
      return core.hullmodSprites;
    case 'shipSystems':
      return core.shipSystemSprites;
    case 'industries':
      return core.industrySprites;
    case 'skills':
      return core.skillSprites;
    case 'abilities':
      return core.abilitySprites;
    case 'commodities':
      return core.commoditySprites;
    default:
      return undefined;
  }
}

function rowsForTable(appData: AppData, table: string): RowData[] {
  const rows = (appData as unknown as Record<string, unknown>)[table];
  return Array.isArray(rows) ? (rows as RowData[]) : [];
}

function coreRowsForTable(core: CoreReferences | undefined, table: string): RowData[] {
  const rows = core?.tables?.[table as TableKey];
  return Array.isArray(rows) ? rows : [];
}

function groupedOptions(modOptions: SelectOption[], coreOptions: SelectOption[]): SelectOption[] {
  const modValues = new Set(modOptions.map((option) => option.value));
  const coreOnly = coreOptions.filter((option) => !modValues.has(option.value));
  const groups: SelectOption[] = [];
  if (modOptions.length > 0) groups.push({ type: 'group', label: '当前 Mod', value: '__mod', children: sortOptions(modOptions) });
  if (coreOnly.length > 0) groups.push({ type: 'group', label: '原版', value: '__core', children: sortOptions(coreOnly) });
  return groups;
}

function sortOptions(options: SelectOption[]): SelectOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

function tagOptions(rows: RowData[]): SelectOption[] {
  const tagSet = new Set<string>();
  for (const row of rows) {
    const raw = String(row.tags ?? '');
    for (const tag of raw.split(',')) {
      const t = tag.trim();
      if (t) tagSet.add(t);
    }
  }
  return [...tagSet].map((tag) => ({ label: tag, value: tag }));
}

function entityOptions(appData: AppData, table: string, col: string, rows: RowData[], origin: 'mod' | 'core'): SelectOption[] {
  const spriteMap = origin === 'mod' ? getSpriteMap(appData, table) : getCoreSpriteMap(appData, table);
  const options: SelectOption[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row[col] ?? '').trim();
    if (!id || isDisabledCsvReference(id) || seen.has(id)) continue;
    seen.add(id);
    const name = String(row.name ?? row.hullName ?? '').trim();
    const label = name && name !== id ? `${name} (${id})` : id;
    const sprite = spriteMap?.[id];
    options.push({ label, value: id, sprite });
  }
  return options;
}

function flattenWeaponSprites(data: Record<string, Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [id, sprites] of Object.entries(data)) {
    const sprite =
      sprites.turretSprite ||
      sprites.hardpointSprite ||
      sprites.turretGunSprite ||
      sprites.hardpointGunSprite ||
      sprites.turretUnderSprite ||
      sprites.hardpointUnderSprite ||
      sprites.turretGlowSprite ||
      sprites.hardpointGlowSprite;
    if (sprite) result[id] = sprite;
  }
  return result;
}

/**
 * Get nested value via dot-notation key path from a RowData object.
 */
export function getNestedValue(obj: RowData, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Immutably set a nested value in a RowData object via dot-notation key path.
 */
export function setNestedValue(obj: RowData, key: string, value: unknown): RowData {
  const parts = key.split('.');
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value as RowData[string] };
  }
  // Deep clone along the path
  const result = { ...obj };
  let target: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = target[parts[i]];
    target[parts[i]] = typeof next === 'object' && next !== null ? { ...(next as Record<string, unknown>) } : {};
    target = target[parts[i]] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Recursively collect all keys from nested fields.
 */
export function collectAllKeys(fields: FieldSchema[]): string[] {
  const keys: string[] = [];
  for (const f of fields) {
    keys.push(f.key);
    if (f.nested) {
      for (const sub of f.nested) {
        keys.push(`${f.key}.${sub.key}`);
      }
    }
  }
  return keys;
}

/**
 * Merge a static schema with core-discovered fields.
 * Fields already defined in the schema are kept as-is.
 * Fields discovered in core but not in schema are added to a "来自原版" section.
 */
export function mergeSchemaWithCoreFields(schema: FileSchema, discoveredFields: DiscoveredField[]): FileSchema {
  if (!discoveredFields || discoveredFields.length === 0) return schema;
  const coreSourceId = getExtraFieldSource(schema) ?? schema.sources?.[0]?.id ?? null;

  // Collect all keys already defined in the static schema
  const definedKeys = new Set<string>();
  const sections = getSections(schema);
  for (const section of sections) {
    for (const field of section.fields) {
      definedKeys.add(coreFieldKey(field.key, coreSourceId));
      if (field.nested) {
        for (const sub of field.nested) {
          definedKeys.add(coreFieldKey(`${field.key}.${sub.key}`, coreSourceId));
        }
      }
    }
  }

  // Filter to only fields NOT already in schema
  const newFields: FieldSchema[] = discoveredFields
    .filter((df) => !definedKeys.has(df.key))
    .map((df) => ({
      key: coreSourceId ? `${coreSourceId}.${df.key}` : df.key,
      type: df.type as FieldSchema['type'],
      label: df.key,
      description: '来自 starsector-core（自动发现）',
    }));

  if (newFields.length === 0) return schema;

  // Add a new section for core-discovered fields
  return {
    ...schema,
    sections: [
      ...sections,
      {
        id: '__core_discovered',
        label: `来自原版 (${newFields.length})`,
        collapsed: true,
        fields: newFields,
      },
    ],
  };
}

function coreFieldKey(key: string, sourceId: string | null): string {
  return sourceId && key.startsWith(`${sourceId}.`) ? key.slice(sourceId.length + 1) : key;
}
