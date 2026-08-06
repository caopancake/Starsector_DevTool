import type { JsonValue, RowData } from '@/shared/types';
import { parseCsvSource } from '@/domain/tables/csv-source-options';
import type { FieldSchema, FileSchema } from '@/domain/schema/schema.types';

export function validateSchemaCsvSources(schema: FileSchema): void {
  const fields = [...(schema.fields ?? []), ...(schema.sections ?? []).flatMap((section) => section.fields)];
  validateSchemaFieldCsvSources(fields, 'file');
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

function scalarToJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function validateSchemaFieldCsvSources(fields: FieldSchema[], parentPath: string): void {
  for (const field of fields) {
    const path = `${parentPath}.${field.key}`;
    if (field.source?.startsWith('csv:') && !parseCsvSource(field.source)) {
      throw new Error(`Invalid CSV source "${field.source}" at schema field "${path}"`);
    }
    if (field.nested) validateSchemaFieldCsvSources(field.nested, path);
    if (field.item) validateSchemaFieldCsvSources([field.item], `${path}[]`);
    if (field.valueSchema) validateSchemaFieldCsvSources([field.valueSchema], `${path}{}`);
  }
}
