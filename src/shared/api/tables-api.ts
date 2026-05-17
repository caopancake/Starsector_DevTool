import { invoke } from '@tauri-apps/api/core';
import type { RowData, TableKey } from '../types';
import type { FileChangeRecord } from './files-api';

export interface AssociatedFileChange {
  relPath: string;
  afterText?: string | null;
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

export interface CsvTable {
  header: string[];
  rows: RowData[];
  path: string;
}
