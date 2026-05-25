import type { HydratedSourceOptionGroup, JsonValue, ResourceRef, RowData } from '@/shared/types';
import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';
import { pathBasename } from '@/shared/lib/paths';
import type { DiscoveredField, FieldSchema, FileSchema, SectionSchema } from '@/domain/schema/schema.types';

import modInfoSchemaRaw from '../../../schemas/mod-info.schema.json';
import factionSchemaRaw from '../../../schemas/faction.schema.json';
import missionSchemaRaw from '../../../schemas/mission.schema.json';
import skinSchemaRaw from '../../../schemas/skin.schema.json';
import variantSchemaRaw from '../../../schemas/variant.schema.json';

const SCHEMAS: Record<string, FileSchema> = {
  'mod-info': schemaAsset(modInfoSchemaRaw),
  faction: schemaAsset(factionSchemaRaw),
  mission: schemaAsset(missionSchemaRaw),
  skin: schemaAsset(skinSchemaRaw),
  variant: schemaAsset(variantSchemaRaw),
};

function schemaAsset(schema: unknown): FileSchema {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Invalid schema asset');
  }
  return schema as FileSchema;
}

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

export function isSchemaInternalKey(key: string): boolean {
  return isInternalJsonFieldKey(key);
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
        value && typeof value === 'object' && !Array.isArray(value) ? ((value as Record<string, unknown>).content ?? '') : value;
    } else {
      result[source.id] = value;
    }
  }
  return result;
}

export interface SelectOption {
  label: string;
  value: string;
  sprite?: string; // data URL for thumbnail preview
  resourceRef?: ResourceRef | null;
  type?: 'group';
  key?: string;
  children?: SelectOption[];
}

export interface FlatSelectOption {
  label: string;
  sprite?: string;
  value: string;
}

export interface SelectOptionGroup {
  key: string;
  label: string;
  options: FlatSelectOption[];
}

export interface SchemaKeyValueEntry {
  key: string;
  val: unknown;
}

const CURRENT_VALUE_OPTION_GROUP = {
  label: '当前值',
  value: '__current',
} as const;

export function resolveEnumSource(source: string | undefined | null): SelectOption[] {
  if (!source) return [];
  if (source.startsWith('enum:')) {
    return source
      .slice(5)
      .split(',')
      .map((v) => ({ label: v.trim(), value: v.trim() }));
  }

  return [];
}

export function selectOptionValueExists(options: SelectOption[], value: string): boolean {
  return options.some((option) => option.value === value || option.children?.some((child) => child.value === value));
}

export function isSelectOptionGroup(option: SelectOption): boolean {
  return option.type === 'group';
}

export function selectOptionText(option: SelectOption): string {
  return option.label || option.value;
}

export function flattenSelectOptions(options: SelectOption[]): FlatSelectOption[] {
  return options.flatMap((option) =>
    isSelectOptionGroup(option) ? (option.children ?? []).map(flatSelectOption) : [flatSelectOption(option)],
  );
}

export function groupSelectOptions(options: SelectOption[]): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = [];
  const ungrouped: FlatSelectOption[] = [];
  for (const option of options) {
    if (isSelectOptionGroup(option)) {
      groups.push({
        key: option.value,
        label: selectOptionText(option),
        options: (option.children ?? []).map(flatSelectOption),
      });
    } else {
      ungrouped.push(flatSelectOption(option));
    }
  }
  if (ungrouped.length > 0) groups.unshift({ key: '__ungrouped', label: '', options: ungrouped });
  return groups;
}

export function includeCurrentSelectOptions(options: SelectOption[], values: string[]): SelectOption[] {
  const seen = new Set<string>();
  const current = values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value) || selectOptionValueExists(options, value)) return false;
      seen.add(value);
      return true;
    })
    .map((value) => ({ label: value, value }));
  if (current.length === 0) return options;
  return [{ type: 'group', ...CURRENT_VALUE_OPTION_GROUP, children: current }, ...options];
}

export function schemaEnumSelectOptions(field: FieldSchema, sourceOptions: SelectOption[]): SelectOption[] {
  if (field.options && field.options.length > 0) return field.options.map((option) => ({ label: option, value: option }));
  return sourceOptions;
}

export function schemaSourceCurrentValues(field: FieldSchema, value: unknown): string[] {
  if (field.type === 'string-array') return schemaArrayStringValues(value);
  if (field.type === 'tag-select') return schemaTagValues(value);
  if (field.type === 'key-value') return schemaKeyValueEntries(value, field.format).map((entry) => entry.key);
  const text = schemaStringValue(value);
  return text ? [text] : [];
}

export function schemaSourceSelectOptions(groups: HydratedSourceOptionGroup[]): SelectOption[] {
  return groups.map((group) => ({
    type: 'group',
    label: group.label,
    value: group.label,
    children: group.options.map((option) => ({
      label: option.label,
      value: option.value,
      sprite: option.sprite,
      resourceRef: option.resourceRef ?? null,
    })),
  }));
}

export function schemaStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function schemaArrayStringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function schemaTagValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (isObjectWithSchemaTags(value)) {
    const tags = value.tags;
    return Array.isArray(tags) ? tags.map(String) : [];
  }
  return [];
}

export function wrapSchemaTagValues(currentValue: unknown, tags: string[]): unknown {
  if (isObjectWithSchemaTags(currentValue)) return { ...currentValue, tags };
  return tags;
}

export function schemaPlainBooleanText(value: unknown): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return schemaStringValue(value);
}

export function parseSchemaPlainBoolean(raw: string): boolean | string {
  const normalized = raw.trim().toLowerCase();
  if (SCHEMA_TRUE_TEXT.has(normalized)) return true;
  if (SCHEMA_FALSE_TEXT.has(normalized)) return false;
  return raw;
}

export function parseSchemaPlainNumber(raw: string, integer: boolean): number | string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const parsed = integer ? parseInt(trimmed, 10) : Number(trimmed);
  return Number.isFinite(parsed) ? parsed : raw;
}

export function formatSchemaCommaList(values: string[]): string {
  return values.join(', ');
}

export function parseSchemaCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function schemaPathDisplayLabel(path: string): string {
  return pathBasename(path);
}

export function schemaKeyValueEntries(value: unknown, format: FieldSchema['format']): SchemaKeyValueEntry[] {
  if (format === 'array-of-entries' && Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const keys = Object.keys(item);
        if (keys.length > 0) return { key: keys[0], val: (item as Record<string, unknown>)[keys[0]] };
      }
      return { key: '', val: '' };
    });
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([key, val]) => ({ key, val }));
  }
  return [];
}

export function schemaKeyValueOutput(
  entries: SchemaKeyValueEntry[],
  format: FieldSchema['format'],
): Record<string, unknown> | Record<string, unknown>[] {
  if (format === 'array-of-entries') return entries.filter((entry) => entry.key).map((entry) => ({ [entry.key]: entry.val }));

  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.key) result[entry.key] = schemaKeyValueObjectValue(entry.val);
  }
  return result;
}

export function appendSchemaKeyValueEntry(
  entries: SchemaKeyValueEntry[],
  format: FieldSchema['format'],
): Record<string, unknown> | Record<string, unknown>[] {
  return schemaKeyValueOutput([...entries, { key: nextSchemaKeyValueKey(entries, format), val: '' }], format);
}

export function parseSchemaKeyValueText(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function formatSchemaKeyValueText(value: unknown): string {
  return schemaStringValue(value);
}

const SCHEMA_TRUE_TEXT = new Set(['true', '1', 'yes', 'y', 'on']);
const SCHEMA_FALSE_TEXT = new Set(['false', '0', 'no', 'n', 'off']);

function isObjectWithSchemaTags(value: unknown): value is Record<string, unknown> & { tags: unknown } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'tags' in value);
}

function schemaKeyValueObjectValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) return value;
  const text = String(value);
  const numberValue = Number(text);
  return !isNaN(numberValue) && text.trim() !== '' ? numberValue : value;
}

function nextSchemaKeyValueKey(entries: SchemaKeyValueEntry[], format: FieldSchema['format']): string {
  const base = format === 'array-of-entries' ? 'newEntry' : 'newField';
  const existingKeys = new Set(entries.map((entry) => entry.key));
  if (!existingKeys.has(base)) return base;
  let index = 1;
  while (existingKeys.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

function flatSelectOption(option: SelectOption): FlatSelectOption {
  return {
    label: selectOptionText(option),
    sprite: option.sprite,
    value: option.value,
  };
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
