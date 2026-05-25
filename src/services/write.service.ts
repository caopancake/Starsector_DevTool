import {
  createIndexedConfigEntity,
  createSkinEntity,
  createVariantEntity,
  deleteIndexedConfigEntity,
  deleteSkinEntity,
  deleteVariantEntity,
  saveIndexedConfigEntity,
  saveSkinEntity,
  saveVariantEntity,
} from '@/shared/api/config-entity-api';
import { replayFileChangeSetOnDisk, saveEditorSpec, saveModFiles, saveTextFile } from '@/shared/api/files-api';
import { saveCsvPatch } from '@/shared/api/tables-api';
import { uploadSprite } from '@/shared/api/assets-api';
import type {
  AssociatedFileChange,
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
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[],
): Promise<WriteResult> {
  return saveCsvPatch(sessionId, table, patches, associatedFiles);
}

export async function writeTextFile(path: string, text: string): Promise<WriteResult> {
  return saveTextFile(path, text);
}

export async function writeEditorSpec(modRoot: string, kind: EditorSpecKind, id: string, data: RowData): Promise<WriteResult> {
  return saveEditorSpec(modRoot, kind, id, data);
}

export async function writeModFiles(modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return saveModFiles(modRoot, files);
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
  modRoot: string,
  filename: string,
  data: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<WriteResult> {
  return uploadSprite(modRoot, filename, data, subfolder, overwrite);
}

export async function replayFileChangeSet(direction: FileChangeReplayDirection, changes: FileChangeRecord[]): Promise<WriteResult> {
  return replayFileChangeSetOnDisk(direction, changes);
}
