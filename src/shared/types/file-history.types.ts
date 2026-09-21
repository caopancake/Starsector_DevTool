import type { FileChangeRecord } from '@/shared/types/history.types';

export interface FileSaveHistoryEntry {
  id: string;
  timestamp: number;
  kind: 'file-save';
  changes: FileChangeRecord[];
  label: string;
}

export type FileHistoryItem = FileSaveHistoryEntry;
