import type { AppData, RowData } from '../../shared/types';
import type { DiscoveredField } from '../../shared/api/tauri';
import type { FieldSchema, FileSchema, SectionSchema } from './schema.types';

import modInfoSchemaRaw from '../../../schemas/mod-info.schema.json';
import factionSchemaRaw from '../../../schemas/faction.schema.json';

const SCHEMAS: Record<string, FileSchema> = {
  'mod-info': modInfoSchemaRaw as unknown as FileSchema,
  faction: factionSchemaRaw as unknown as FileSchema,
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

export interface SelectOption {
  label: string;
  value: string;
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
      const valSet = new Set<string>();
      for (const row of rows) {
        const v = String(row[col] ?? '').trim();
        if (v) valSet.add(v);
      }
      return [...valSet].sort().map((v) => ({ label: v, value: v }));
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

  // Collect all keys already defined in the static schema
  const definedKeys = new Set<string>();
  const sections = getSections(schema);
  for (const section of sections) {
    for (const field of section.fields) {
      definedKeys.add(field.key);
      if (field.nested) {
        for (const sub of field.nested) {
          definedKeys.add(`${field.key}.${sub.key}`);
        }
      }
    }
  }

  // Filter to only fields NOT already in schema
  const newFields: FieldSchema[] = discoveredFields
    .filter((df) => !definedKeys.has(df.key))
    .map((df) => ({
      key: df.key,
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
