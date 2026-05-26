import type { FileChangeRecord } from '@/shared/types/history.types';
import type { RowData } from '@/shared/types/json.types';

export interface CsvRowKeyMapping {
  previousKey: string;
  nextKey: string;
}

export interface WriteResult {
  changes: FileChangeRecord[];
  invalidatedPaths: string[];
  keyMap: CsvRowKeyMapping[];
  refreshedEntity: RowData | null;
  warnings: string[];
}

export interface SpriteUploadState {
  ok: boolean;
  exists: boolean;
  path: string;
  overwritten: boolean;
  message: string | null;
}

export interface SpriteUploadResult {
  state: SpriteUploadState;
  write: WriteResult;
}

export type SpriteSubfolder = 'ships' | 'weapons' | 'missiles' | 'fx';

export interface AssociatedFileChange {
  relPath: string;
  afterText: string | null;
  afterDataBase64: string | null;
  previousRelPath: string | null;
}

export type CsvRowPatchAction = 'upsert' | 'delete';

export interface CsvRowPatch {
  rowKey: string;
  action: CsvRowPatchAction;
  row: RowData;
}
