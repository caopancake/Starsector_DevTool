import type { TableKey } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-options';

import abilitiesColumnsRaw from '../../../schemas/csv/abilities.columns.json';
import commoditiesColumnsRaw from '../../../schemas/csv/commodities.columns.json';
import descriptionsColumnsRaw from '../../../schemas/csv/descriptions.columns.json';
import hullmodsColumnsRaw from '../../../schemas/csv/hullmods.columns.json';
import industriesColumnsRaw from '../../../schemas/csv/industries.columns.json';
import marketConditionsColumnsRaw from '../../../schemas/csv/marketConditions.columns.json';
import shipSystemsColumnsRaw from '../../../schemas/csv/shipSystems.columns.json';
import shipsColumnsRaw from '../../../schemas/csv/ships.columns.json';
import simOpponentsColumnsRaw from '../../../schemas/csv/simOpponents.columns.json';
import skillsColumnsRaw from '../../../schemas/csv/skills.columns.json';
import specialItemsColumnsRaw from '../../../schemas/csv/specialItems.columns.json';
import submarketsColumnsRaw from '../../../schemas/csv/submarkets.columns.json';
import weaponsColumnsRaw from '../../../schemas/csv/weapons.columns.json';
import wingsColumnsRaw from '../../../schemas/csv/wings.columns.json';

export type CsvColumnControl = 'text' | 'number' | 'boolean' | 'enum' | 'reference' | 'tags' | 'multi' | 'path-image' | 'color';

export interface CsvColumnSchema {
  key: string;
  label?: string;
  control: CsvColumnControl;
  source?: string;
  options?: string[];
  default?: string;
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  priority?: number;
}

type TableColumnSchemas = Record<TableKey, CsvColumnSchema[]>;

export const CSV_COLUMN_SCHEMAS: TableColumnSchemas = {
  abilities: abilitiesColumnsRaw as CsvColumnSchema[],
  commodities: commoditiesColumnsRaw as CsvColumnSchema[],
  descriptions: descriptionsColumnsRaw as CsvColumnSchema[],
  hullmods: hullmodsColumnsRaw as CsvColumnSchema[],
  industries: industriesColumnsRaw as CsvColumnSchema[],
  marketConditions: marketConditionsColumnsRaw as CsvColumnSchema[],
  shipSystems: shipSystemsColumnsRaw as CsvColumnSchema[],
  ships: shipsColumnsRaw as CsvColumnSchema[],
  simOpponents: simOpponentsColumnsRaw as CsvColumnSchema[],
  skills: skillsColumnsRaw as CsvColumnSchema[],
  specialItems: specialItemsColumnsRaw as CsvColumnSchema[],
  submarkets: submarketsColumnsRaw as CsvColumnSchema[],
  weapons: weaponsColumnsRaw as CsvColumnSchema[],
  wings: wingsColumnsRaw as CsvColumnSchema[],
};

const EMPTY_SCHEMAS: CsvColumnSchema[] = [];
const CSV_BOOLEAN_OPTIONS: SelectOption[] = [
  { label: 'TRUE', value: 'TRUE' },
  { label: 'FALSE', value: 'FALSE' },
];

export function csvColumnSchemasForTable(table: TableKey): CsvColumnSchema[] {
  return CSV_COLUMN_SCHEMAS[table] ?? EMPTY_SCHEMAS;
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
