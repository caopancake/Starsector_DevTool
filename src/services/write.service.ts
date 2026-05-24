import {
  applyFileChangeSet as applyFileChangeSetApi,
  createIndexedConfigEntity as createIndexedConfigEntityApi,
  createSkinEntity as createSkinEntityApi,
  createVariantEntity as createVariantEntityApi,
  deleteIndexedConfigEntity as deleteIndexedConfigEntityApi,
  deleteSkinEntity as deleteSkinEntityApi,
  deleteVariantEntity as deleteVariantEntityApi,
  saveCsvPatch as saveCsvPatchApi,
  saveIndexedConfigEntity as saveIndexedConfigEntityApi,
  saveJson as saveJsonApi,
  saveModFiles as saveModFilesApi,
  saveSkinEntity as saveSkinEntityApi,
  saveTextFile as saveTextFileApi,
  saveVariantEntity as saveVariantEntityApi,
  uploadSprite as uploadSpriteApi,
  type AssociatedFileChange,
  type CsvRowPatch,
  type DeleteIndexedConfigEntityPayload,
  type DeleteSkinEntityPayload,
  type DeleteVariantEntityPayload,
  type FileChangeRecord,
  type IndexedConfigEntityPayload,
  type IndexedConfigEntityResult,
  type SkinEntityPayload,
  type SkinEntityResult,
  type UploadResult,
  type VariantEntityPayload,
  type VariantEntityResult,
  type WriteResult,
} from '@/shared/api/write-api';
import type { RowData, TableKey } from '@/shared/types';

export type { AssociatedFileChange, CsvRowPatch, WriteResult };
export type { FileChangeRecord };

export type WriteResultWith<T> = WriteResult & T;

export async function writeCsvPatch(
  sessionId: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<WriteResult> {
  const result = await saveCsvPatchApi(sessionId, table, patches, associatedFiles);
  return normalizeWriteResult(result.changes, {
    keyMap: result.keyMap,
  });
}

export async function writeTextFile(path: string, text: string): Promise<WriteResult> {
  return normalizeWriteResult(await saveTextFileApi(path, text));
}

export async function writeJsonSpec(
  modRoot: string,
  relDir: string,
  ext: string,
  idKey: string,
  id: string,
  data: RowData,
): Promise<WriteResult> {
  return normalizeWriteResult(await saveJsonApi(modRoot, relDir, ext, idKey, id, data));
}

export async function writeModFiles(modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return normalizeWriteResult(await saveModFilesApi(modRoot, files));
}

export async function writeIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  const result = await saveIndexedConfigEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.entityPayload }) };
}

export async function createIndexedConfigEntity(payload: IndexedConfigEntityPayload): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  const result = await createIndexedConfigEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.entityPayload }) };
}

export async function deleteIndexedConfigEntity(
  payload: DeleteIndexedConfigEntityPayload,
): Promise<WriteResultWith<IndexedConfigEntityResult>> {
  const result = await deleteIndexedConfigEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.entityPayload }) };
}

export async function writeVariantEntity(payload: VariantEntityPayload): Promise<WriteResultWith<VariantEntityResult>> {
  const result = await saveVariantEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.variantFile as unknown as RowData }) };
}

export async function createVariantEntity(payload: VariantEntityPayload): Promise<WriteResultWith<VariantEntityResult>> {
  const result = await createVariantEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.variantFile as unknown as RowData }) };
}

export async function deleteVariantEntity(payload: DeleteVariantEntityPayload): Promise<WriteResult> {
  return normalizeWriteResult(await deleteVariantEntityApi(payload));
}

export async function writeSkinEntity(payload: SkinEntityPayload): Promise<WriteResultWith<SkinEntityResult>> {
  const result = await saveSkinEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.skinFile as unknown as RowData }) };
}

export async function createSkinEntity(payload: SkinEntityPayload): Promise<WriteResultWith<SkinEntityResult>> {
  const result = await createSkinEntityApi(payload);
  return { ...result, ...normalizeWriteResult(result.changes, { refreshedEntity: result.skinFile as unknown as RowData }) };
}

export async function deleteSkinEntity(payload: DeleteSkinEntityPayload): Promise<WriteResult> {
  return normalizeWriteResult(await deleteSkinEntityApi(payload));
}

export async function uploadSprite(
  modRoot: string,
  filename: string,
  data: string,
  subfolder: 'ships' | 'weapons' | 'missiles' | 'fx',
  overwrite = false,
): Promise<WriteResultWith<UploadResult>> {
  const result = await uploadSpriteApi(modRoot, filename, data, subfolder, overwrite);
  return { ...result, ...normalizeWriteResult(result.changes) };
}

export async function applyFileChangeSet(direction: 'undo' | 'redo', changes: FileChangeRecord[]): Promise<WriteResult> {
  await applyFileChangeSetApi(direction, changes);
  return normalizeWriteResult(changes);
}

function normalizeWriteResult(
  changes: FileChangeRecord[],
  overrides: Partial<Omit<WriteResult, 'changes' | 'invalidatedPaths'>> = {},
): WriteResult {
  return {
    changes,
    invalidatedPaths: pathsFromChanges(changes),
    keyMap: overrides.keyMap ?? [],
    refreshedEntity: overrides.refreshedEntity ?? null,
    warnings: overrides.warnings ?? [],
  };
}

function pathsFromChanges(changes: FileChangeRecord[]): string[] {
  return [...new Set(changes.map((change) => change.path).filter(Boolean))];
}
