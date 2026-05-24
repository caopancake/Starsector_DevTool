import { invoke } from '@tauri-apps/api/core';
import type { ConfigFileEntityPayload, RowData, SkinFile, TableKey, VariantFile } from '@/shared/types';

export interface EditableFileData {
  path: string;
  text: string;
}

export interface FileSnapshot {
  relPath: string;
  text?: string | null;
  dataBase64?: string | null;
}

export interface FileChangeRecord {
  kind: 'file' | 'directory';
  path: string;
  beforeExists: boolean;
  beforeText?: string | null;
  beforeDataBase64?: string | null;
  beforeFiles: FileSnapshot[];
  afterExists: boolean;
  afterText?: string | null;
  afterDataBase64?: string | null;
  afterFiles: FileSnapshot[];
}

export interface WriteResult {
  changes: FileChangeRecord[];
  invalidatedPaths: string[];
  keyMap?: Array<{ previousKey: string; nextKey: string }>;
  refreshedEntity?: RowData | null;
  warnings?: string[];
}

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

export type VariantEntityPayload = ConfigFileEntityPayload;

export interface DeleteVariantEntityPayload {
  modRoot: string;
  variantId: string;
  relPath: string;
}

export interface VariantEntityResult {
  changes: FileChangeRecord[];
  variantFile: VariantFile;
}

export type SkinEntityPayload = ConfigFileEntityPayload;

export interface DeleteSkinEntityPayload {
  modRoot: string;
  skinHullId: string;
  relPath: string;
}

export interface SkinEntityResult {
  changes: FileChangeRecord[];
  skinFile: SkinFile;
}

export interface UploadResult {
  ok: boolean;
  exists: boolean;
  path: string;
  overwritten: boolean;
  message?: string;
  changes: FileChangeRecord[];
}

export function saveCsvPatch(
  sessionId: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<SaveCsvPatchResult> {
  return invoke('save_csv_patch_with_history', { payload: { sessionId, table, patches, associatedFiles } });
}

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { path });
}

export function saveTextFile(path: string, text: string): Promise<FileChangeRecord[]> {
  return invoke('save_text_file_with_history', { payload: { path, text } });
}

export function saveJson(
  modRoot: string,
  relDir: string,
  ext: string,
  idKey: string,
  id: string,
  data: RowData,
): Promise<FileChangeRecord[]> {
  return invoke('save_json_with_history', { payload: { modRoot, relDir, ext, idKey, id, data } });
}

export function saveModFiles(modRoot: string, files: AssociatedFileChange[]): Promise<FileChangeRecord[]> {
  return invoke('save_mod_files_with_history', { payload: { modRoot, files } });
}

export function applyFileChangeSet(direction: 'undo' | 'redo', changes: FileChangeRecord[]): Promise<void> {
  return invoke('apply_file_change_set', { payload: { direction, changes } });
}

export function uploadSprite(
  modRoot: string,
  filename: string,
  data: string,
  subfolder: 'ships' | 'weapons' | 'missiles' | 'fx',
  overwrite = false,
): Promise<UploadResult> {
  return invoke('upload_sprite', { payload: { modRoot, filename, data, subfolder, overwrite } });
}

export function saveIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('save_indexed_config_entity_with_history', { payload });
}

export function createIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('create_indexed_config_entity_with_history', { payload });
}

export function deleteIndexedConfigEntity(payload: DeleteIndexedConfigEntityPayload): Promise<IndexedConfigEntityResult> {
  return invoke('delete_indexed_config_entity_with_history', { payload });
}

export function saveVariantEntity(payload: VariantEntityPayload): Promise<VariantEntityResult> {
  return invoke('save_variant_entity_with_history', { payload });
}

export function createVariantEntity(payload: VariantEntityPayload): Promise<VariantEntityResult> {
  return invoke('create_variant_entity_with_history', { payload });
}

export function deleteVariantEntity(payload: DeleteVariantEntityPayload): Promise<FileChangeRecord[]> {
  return invoke('delete_variant_entity_with_history', { payload });
}

export function saveSkinEntity(payload: SkinEntityPayload): Promise<SkinEntityResult> {
  return invoke('save_skin_entity_with_history', { payload });
}

export function createSkinEntity(payload: SkinEntityPayload): Promise<SkinEntityResult> {
  return invoke('create_skin_entity_with_history', { payload });
}

export function deleteSkinEntity(payload: DeleteSkinEntityPayload): Promise<FileChangeRecord[]> {
  return invoke('delete_skin_entity_with_history', { payload });
}
