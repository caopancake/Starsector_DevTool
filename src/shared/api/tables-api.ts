import { invoke } from '@tauri-apps/api/core';
import type { AssociatedFileChange, CsvRowPatch, ProjectSessionId, TableKey, WriteResult } from '@/shared/types';

export function saveCsvPatch(
  sessionId: ProjectSessionId,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[],
): Promise<WriteResult> {
  return invoke('save_csv_patch', { payload: { sessionId, table, patches, associatedFiles } });
}
