import type { FileChangeRecord } from '../../shared/api/files-api';

export interface FileSaveHistoryEntry {
  id: string;
  timestamp: number;
  kind: 'file-save';
  changes: FileChangeRecord[];
  label: string;
}

export interface FileHistoryBarrier {
  id: string;
  timestamp: number;
  kind: 'barrier';
  reason: 'sprite-overwrite';
  label: string;
}

export type FileHistoryItem = FileSaveHistoryEntry | FileHistoryBarrier;

export function isFileSaveEntry(item: FileHistoryItem): item is FileSaveHistoryEntry {
  return item.kind === 'file-save';
}

export function isFileHistoryBarrier(item: FileHistoryItem): item is FileHistoryBarrier {
  return item.kind === 'barrier';
}
