import { invoke } from '@tauri-apps/api/core';
import type { RowData } from '../types';
import type { FileChangeRecord } from './files-api';

export type IndexedConfigEntityKind = 'faction' | 'mission';

export interface IndexedConfigEntityPayload {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  previousId?: string | null;
  nextId: string;
  indexRow: RowData;
  payload: RowData;
  deletePreviousTarget?: boolean;
}

export interface DeleteIndexedConfigEntityPayload {
  modRoot: string;
  kind: IndexedConfigEntityKind;
  id: string;
  deleteTarget?: boolean;
}

export interface IndexedConfigEntityResult {
  changes: FileChangeRecord[];
  entityId: string;
  indexPath: string;
  indexHeader: string[];
  indexRows: RowData[];
  entityPayload: RowData | null;
}

export function saveIndexedConfigEntityWithHistory(payload: IndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('save_indexed_config_entity_with_history', { payload });
}

export function createIndexedConfigEntityWithHistory(payload: IndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('create_indexed_config_entity_with_history', { payload });
}

export function deleteIndexedConfigEntityWithHistory(payload: DeleteIndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('delete_indexed_config_entity_with_history', { payload });
}
