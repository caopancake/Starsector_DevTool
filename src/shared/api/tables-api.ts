import { invoke } from '@tauri-apps/api/core';
import type { RowData, TableKey } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

export interface AssociatedFileChange {
  relPath: string;
  afterText?: string | null;
  afterDataBase64?: string | null;
}

export function saveCsvWithHistory(
  modRoot: string,
  table: TableKey,
  header: string[],
  rows: RowData[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<FileChangeRecord[]> {
  return invoke('save_csv_with_history', { payload: { modRoot, table, header, rows, associatedFiles } });
}

export const saveCsv = saveCsvWithHistory;

export function loadCsvTable(modRoot: string, table: TableKey): Promise<CsvTable> {
  return invoke('load_csv_table', { payload: { modRoot, table } });
}

export interface CsvTable {
  header: string[];
  rows: RowData[];
  path: string;
}
