import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';
import type { FileSchema, SectionSchema } from '@/domain/schema/schema.types';

export function getSchemaSections(schema: FileSchema): SectionSchema[] {
  if (schema.sections && schema.sections.length > 0) {
    return schema.sections;
  }
  if (schema.fields && schema.fields.length > 0) {
    return [{ id: '__all', label: schema.displayName ?? '所有字段', fields: schema.fields }];
  }
  return [];
}

export function getSchemaFieldKeys(schema: FileSchema): string[] {
  const sections = getSchemaSections(schema);
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

export function schemaSectionCollapseIdentity(schema: FileSchema): string {
  return schemaStableIdentity([schema.id, getSchemaSections(schema).map((section) => [section.id, section.collapsed])]);
}

export function schemaStableIdentity(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => schemaStableIdentity(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${schemaStableIdentity(record[key])}`).join(',')}}`;
}
