import {
  applyFileChangeSet,
  createIndexedConfigEntity,
  createSkinEntity,
  createVariantEntity,
  deleteIndexedConfigEntity,
  deleteSkinEntity,
  deleteVariantEntity,
  saveCsvPatch,
  saveEditorSpec,
  saveIndexedConfigEntity,
  saveModFiles,
  saveSkinEntity,
  saveTextFile,
  saveVariantEntity,
  uploadSprite,
} from '@/shared/api/write-api';
import type {
  AssociatedFileChange,
  AssociatedSpecChange,
  CsvRowPatch,
  DeleteIndexedConfigEntityWrite,
  DeleteSkinEntityWrite,
  DeleteVariantEntityWrite,
  FileChangeRecord,
  FileChangeReplayDirection,
  IndexedConfigEntityWrite,
  RowData,
  SkinEntityWrite,
  SpriteSubfolder,
  TableKey,
  VariantEntityWrite,
  WriteResult,
} from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types/editor.types';

export async function writeCsvPatch(
  sessionId: string,
  modRoot: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedSpecs: AssociatedSpecChange[],
): Promise<WriteResult> {
  return saveCsvPatch(sessionId, modRoot, table, patches, associatedSpecs);
}

export async function writeTextFile(sessionId: string | null, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return saveTextFile(sessionId, modRoot, path, text);
}

export async function writeEditorSpec(
  sessionId: string,
  modRoot: string,
  kind: EditorSpecKind,
  id: string,
  data: RowData,
): Promise<WriteResult> {
  return saveEditorSpec(sessionId, modRoot, kind, id, data);
}

export async function writeModFiles(sessionId: string, modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return saveModFiles(sessionId, modRoot, files);
}

export async function writeIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return saveIndexedConfigEntity(write);
}

export async function writeCreateIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return createIndexedConfigEntity(write);
}

export async function writeDeleteIndexedConfigEntity(write: DeleteIndexedConfigEntityWrite): Promise<WriteResult> {
  return deleteIndexedConfigEntity(write);
}

export async function writeVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return saveVariantEntity(write);
}

export async function writeCreateVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return createVariantEntity(write);
}

export async function writeDeleteVariantEntity(write: DeleteVariantEntityWrite): Promise<WriteResult> {
  return deleteVariantEntity(write);
}

export async function writeSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return saveSkinEntity(write);
}

export async function writeCreateSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return createSkinEntity(write);
}

export async function writeDeleteSkinEntity(write: DeleteSkinEntityWrite): Promise<WriteResult> {
  return deleteSkinEntity(write);
}

export async function writeSpriteUpload(
  sessionId: string,
  modRoot: string,
  filename: string,
  data: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<WriteResult> {
  return uploadSprite(sessionId, modRoot, filename, data, subfolder, overwrite);
}

export async function replayFileChangeSet(
  sessionId: string,
  modRoot: string,
  direction: FileChangeReplayDirection,
  changes: FileChangeRecord[],
): Promise<WriteResult> {
  return applyFileChangeSet(sessionId, modRoot, direction, changes);
}
