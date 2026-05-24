import { invoke } from '@tauri-apps/api/core';
import type { RowData, TableKey } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

export interface AssociatedFileChange {
  relPath: string;
  afterText?: string | null;
  afterDataBase64?: string | null;
}

export interface CsvRowPatch {
  rowKey: string;
  action: 'upsert' | 'delete';
  row?: RowData;
}

export interface SaveCsvPatchResult {
  changes: FileChangeRecord[];
  keyMap: Array<{ previousKey: string; nextKey: string }>;
}

export interface CsvTable {
  header: string[];
  rows: RowData[];
  path: string;
}

export function saveCsvPatchWithHistory(
  sessionId: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<SaveCsvPatchResult> {
  return invoke('save_csv_patch_with_history', { payload: { sessionId, table, patches, associatedFiles } });
}
