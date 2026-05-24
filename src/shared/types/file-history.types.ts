import type { FileChangeRecord } from '@/shared/api/write-api';

export interface FileSaveHistoryEntry {
  id: string;
  timestamp: number;
  kind: 'file-save';
  changes: FileChangeRecord[];
  label: string;
}

export type FileHistoryItem = FileSaveHistoryEntry;

export function isFileSaveEntry(item: FileHistoryItem): item is FileSaveHistoryEntry {
  return item.kind === 'file-save';
}
