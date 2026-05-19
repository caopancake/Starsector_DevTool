import type { TableKey } from '@/shared/types';

import abilitiesColumnsRaw from '../../../schemas/csv/abilities.columns.json';
import commoditiesColumnsRaw from '../../../schemas/csv/commodities.columns.json';
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

export function csvColumnSchemasForTable(table: TableKey): CsvColumnSchema[] {
  return CSV_COLUMN_SCHEMAS[table] ?? EMPTY_SCHEMAS;
}

export function csvColumnSchemaFor(table: TableKey, column: string): CsvColumnSchema | null {
  return csvColumnSchemasForTable(table).find((schema) => schema.key === column) ?? null;
}
