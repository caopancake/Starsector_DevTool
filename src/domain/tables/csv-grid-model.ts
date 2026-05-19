import type { AppData, RowData, TableKey } from '@/shared/types';
import { cell } from '@/shared/lib/starsector';
import { csvColumnSchemaFor, type CsvColumnSchema } from '@/domain/tables/csv-column-schema';
import { createCsvSourceIndex, type CsvSourceIndex } from '@/domain/tables/csv-source-options';
import type { SelectOption } from '@/domain/schema/schema-registry';

export interface CsvGridColumn {
  className: string;
  enumOptions: SelectOption[];
  key: string;
  schema: CsvColumnSchema | null;
  widthPx: number;
}

export interface CsvGridRow {
  row: RowData;
  rowIndex: number;
  rowKey: string;
}

export interface CsvGridModel {
  columns: CsvGridColumn[];
  rows: CsvGridRow[];
  sourceIndex: CsvSourceIndex;
  totalWidthPx: number;
}

export function createCsvGridModel(
  table: TableKey,
  visibleColumns: string[],
  filteredRows: RowData[],
  appData: AppData | null,
  rowKeyFor: (row: RowData, index: number) => string,
): CsvGridModel {
  const columns = visibleColumns.map((key) => createCsvGridColumn(table, key, filteredRows));
  const rows = filteredRows.map((row, rowIndex) => ({ row, rowIndex, rowKey: rowKeyFor(row, rowIndex) }));
  const sourceIndex = createCsvSourceIndex(
    appData,
    columns.map((column) => column.schema?.source),
  );
  const totalWidthPx = columns.reduce((sum, column) => sum + column.widthPx, 0);
  return { columns, rows, sourceIndex, totalWidthPx };
}

function createCsvGridColumn(table: TableKey, key: string, rows: RowData[]): CsvGridColumn {
  const schema = csvColumnSchemaFor(table, key);
  return {
    className: `schema-col-${schema?.control ?? 'text'}`,
    enumOptions: (schema?.options ?? []).map((option) => ({ label: option, value: option })),
    key,
    schema,
    widthPx: columnWidthPx(key, schema, rows),
  };
}

function columnWidthPx(key: string, schema: CsvColumnSchema | null, rows: RowData[]): number {
  const headerWidth = textWidthPx(key, 'header');
  const control = schema?.control ?? 'text';
  const contentWidth = maxColumnContentWidthPx(key, rows);

  if (control === 'number') return clamp(Math.max(headerWidth, contentWidth) + 24, 48, 120);
  if (control === 'boolean') return clamp(headerWidth + 34, 70, 110);
  if (control === 'enum') return clamp(headerWidth + 34, 88, 150);
  if (control === 'reference') return clamp(headerWidth + 42, 120, 220);
  if (control === 'tags' || control === 'multi') return clamp(Math.max(headerWidth + 42, tagColumnWidthPx(key, rows)), 220, 560);
  if (control === 'path-image') return clamp(Math.max(headerWidth, contentWidth * 0.6) + 24, 120, 220);
  return clamp(Math.max(headerWidth, contentWidth) + 24, 64, textColumnMaxPx(key));
}

function maxColumnContentWidthPx(key: string, rows: RowData[]): number {
  let maxWidth = 0;
  for (const row of rows) {
    maxWidth = Math.max(maxWidth, textWidthPx(cell(row[key]), 'cell'));
  }
  return maxWidth;
}

function textColumnMaxPx(key: string): number {
  const normalized = key.toLowerCase();
  if (normalized.includes('id')) return 320;
  if (normalized.includes('path') || normalized.includes('sprite') || normalized.includes('icon')) return 260;
  if (normalized.includes('name')) return 260;
  return 220;
}

function tagColumnWidthPx(key: string, rows: RowData[]): number {
  const rowWidths = rows
    .map((row) => tagRowWidthPx(cell(row[key])))
    .filter((width) => width > 0)
    .sort((a, b) => a - b);
  if (rowWidths.length === 0) return 160;
  const index = Math.min(rowWidths.length - 1, Math.floor(rowWidths.length * 0.9));
  return rowWidths[index] + 20;
}

function tagRowWidthPx(value: string): number {
  const tags = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (tags.length === 0) return 0;
  const chipWidths = tags.map((tag) => clamp(textWidthPx(tag, 'cell') + 14, 32, 128));
  return chipWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, chipWidths.length - 1) * 4;
}

function textWidthPx(value: string, kind: 'cell' | 'header'): number {
  const base = kind === 'header' ? 8.2 : 7.2;
  let width = 0;
  for (const char of value) {
    if (/[\u4e00-\u9fff]/u.test(char)) width += 12;
    else if (char === '_' || char === '-' || char === '/') width += 6.5;
    else if (char === ' ') width += 4;
    else width += base;
  }
  return Math.ceil(width);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.ceil(value)));
}
