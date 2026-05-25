import type { RowData } from '@/shared/types/json.types';
import type { TableKey } from '@/shared/types/tables.types';

export interface CsvCellEditEvent {
  type: 'csv-cell-edit';
  tab: TableKey;
  rowKey: string;
  col: string;
  previousValue: string;
  newValue: string;
}

export interface CsvRowCreateEvent {
  type: 'row-create';
  tab: TableKey;
  rowKey: string;
  rowIndex: number;
  row: RowData;
}

export interface CsvRowDeleteEvent {
  type: 'row-delete';
  tab: TableKey;
  rowKey: string;
  rowIndex: number;
  row: RowData;
}

export type CsvEditHistoryEvent = CsvCellEditEvent | CsvRowCreateEvent | CsvRowDeleteEvent;

export interface CsvEditHistoryEntry {
  id: string;
  timestamp: number;
  event: CsvEditHistoryEvent;
  label: string;
}
