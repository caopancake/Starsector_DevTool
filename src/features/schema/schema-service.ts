import type { AppData, JsonValue, RowData } from '../../shared/types';
import type { DiscoveredField } from '../../shared/api/assets-api';
import type { FieldSchema, FileSchema, SectionSchema } from './schema-types';

import modInfoSchemaRaw from '../../../schemas/mod-info.schema.json';
import factionSchemaRaw from '../../../schemas/faction.schema.json';
import missionSchemaRaw from '../../../schemas/mission.schema.json';

const SCHEMAS: Record<string, FileSchema> = {
  'mod-info': modInfoSchemaRaw as unknown as FileSchema,
  faction: factionSchemaRaw as unknown as FileSchema,
  mission: missionSchemaRaw as unknown as FileSchema,
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

    const rows = (appData as unknown as Record<string, unknown>)[table] as RowData[] | undefined;
    if (!rows || !Array.isArray(rows)) return [];

    if (col === 'tags') {
      const tagSet = new Set<string>();
      for (const row of rows) {
        const raw = String(row.tags ?? '');
        for (const tag of raw.split(',')) {
          const t = tag.trim();
          if (t) tagSet.add(t);
        }
      }
      return [...tagSet].sort().map((t) => ({ label: t, value: t }));
    } else {
      // Extract id + name for display, with optional sprite
      const spriteMap = getSpriteMap(appData, table);
      const options: SelectOption[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const id = String(row[col] ?? '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const name = String(row.name ?? row.hullName ?? '').trim();
        const label = name && name !== id ? `${name} (${id})` : id;
        const sprite = spriteMap?.[id];
        options.push({ label, value: id, sprite });
      }
      return options.sort((a, b) => a.label.localeCompare(b.label));
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
      return appData.shipSprites;
    case 'hullmods':
      return appData.hullmodSprites;
    case 'industries':
      return appData.industrySprites;
    default:
      return undefined;
  }
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
