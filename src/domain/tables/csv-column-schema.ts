import type { TableKey } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-options';
import type { CsvColumnControl, CsvColumnSchema } from '@/domain/schema/schema.types';
import { getCsvColumnSchemas } from '@/domain/schema/schema-registry';

const CSV_BOOLEAN_OPTIONS: SelectOption[] = [
  { label: 'TRUE', value: 'TRUE' },
  { label: 'FALSE', value: 'FALSE' },
];

const EMPTY_SCHEMAS: CsvColumnSchema[] = [];

export function csvColumnSchemasForTable(table: TableKey): CsvColumnSchema[] {
  return getCsvColumnSchemas(table) || EMPTY_SCHEMAS;
}

export function csvColumnSchemaFor(table: TableKey, column: string): CsvColumnSchema | null {
  return csvColumnSchemasForTable(table).find((schema) => schema.key === column) ?? null;
}

export function csvColumnControl(schema: CsvColumnSchema | null | undefined): CsvColumnControl {
  return schema?.control ?? 'text';
}

export function isCsvListControl(control: CsvColumnControl): boolean {
  return control === 'tags' || control === 'multi';
}

export function isCsvReferenceControl(control: CsvColumnControl): boolean {
  return control === 'reference';
}

export function csvListValues(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatCsvListValue(values: string[]): string {
  return values.join(', ');
}

export function csvBooleanOptions(): SelectOption[] {
  return [...CSV_BOOLEAN_OPTIONS];
}

export function csvBooleanDisplayValue(value: string): string {
  if (!value) return '-';
  const normalized = value.toLowerCase();
  if (normalized === 'true') return 'true';
  if (normalized === 'false') return 'false';
  return value;
}

export function csvControlUsesNativeInput(control: CsvColumnControl): boolean {
  return control === 'number' || control === 'path-image' || control === 'color' || control === 'text';
}

export function csvControlUsesPicker(control: CsvColumnControl): boolean {
  return control === 'boolean' || control === 'enum' || control === 'reference' || isCsvListControl(control);
}

export function csvColumnControlLabel(control: CsvColumnControl): string {
  switch (control) {
    case 'number':
      return '数值';
    case 'boolean':
      return '布尔';
    case 'enum':
      return '枚举';
    case 'reference':
      return '引用';
    case 'tags':
      return '标签';
    case 'multi':
      return '多值';
    case 'path-image':
      return '图片路径';
    case 'color':
      return '颜色';
    default:
      return '文本';
  }
}
