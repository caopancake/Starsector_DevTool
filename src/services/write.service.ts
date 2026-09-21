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
} from '@/shared/api/write-api';
import { AppError } from '@/shared/lib/errors';
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
  EditorSpecKind,
  RowData,
  SkinEntityWrite,
  TableKey,
  VariantEntityWrite,
  WriteResult,
} from '@/shared/types';

const inFlightTargets = new Set<string>();

async function runExclusiveWrite<T>(target: string, operation: () => Promise<T>): Promise<T> {
  if (inFlightTargets.has(target)) {
    throw new AppError('相同目标的保存正在进行，请等待其完成', { action: 'exclusive-write' });
  }
  inFlightTargets.add(target);
  try {
    return await operation();
  } finally {
    inFlightTargets.delete(target);
  }
}

export async function writeCsvPatch(
  sessionId: string,
  modRoot: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedSpecs: AssociatedSpecChange[],
): Promise<WriteResult> {
  return runExclusiveWrite(`csv:${sessionId}:${table}`, () => saveCsvPatch(sessionId, modRoot, table, patches, associatedSpecs));
}

export async function writeTextFile(sessionId: string | null, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return runExclusiveWrite(`text:${modRoot}:${path}`, () => saveTextFile(sessionId, modRoot, path, text));
}

export async function writeEditorSpec(
  sessionId: string,
  modRoot: string,
  kind: EditorSpecKind,
  id: string,
  data: RowData,
): Promise<WriteResult> {
  return runExclusiveWrite(`spec:${kind}:${modRoot}:${id}`, () => saveEditorSpec(sessionId, modRoot, kind, id, data));
}

export async function writeModFiles(sessionId: string, modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return runExclusiveWrite(`mod-files:${sessionId}:${modRoot}`, () => saveModFiles(sessionId, modRoot, files));
}

export async function writeIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`indexed-save:${write.sessionId}:${write.kind}:${write.nextId}`, () => saveIndexedConfigEntity(write));
}

export async function writeCreateIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`indexed-create:${write.sessionId}:${write.kind}:${write.nextId}`, () => createIndexedConfigEntity(write));
}

export async function writeDeleteIndexedConfigEntity(write: DeleteIndexedConfigEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`indexed-delete:${write.sessionId}:${write.kind}:${write.id}`, () => deleteIndexedConfigEntity(write));
}

export async function writeVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`variant-save:${write.sessionId}:${write.nextId}`, () => saveVariantEntity(write));
}

export async function writeCreateVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`variant-create:${write.sessionId}:${write.nextId}`, () => createVariantEntity(write));
}

export async function writeDeleteVariantEntity(write: DeleteVariantEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`variant-delete:${write.sessionId}:${write.relPath}`, () => deleteVariantEntity(write));
}

export async function writeSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`skin-save:${write.sessionId}:${write.nextId}`, () => saveSkinEntity(write));
}

export async function writeCreateSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`skin-create:${write.sessionId}:${write.nextId}`, () => createSkinEntity(write));
}

export async function writeDeleteSkinEntity(write: DeleteSkinEntityWrite): Promise<WriteResult> {
  return runExclusiveWrite(`skin-delete:${write.sessionId}:${write.relPath}`, () => deleteSkinEntity(write));
}

export async function replayFileChangeSet(
  sessionId: string,
  modRoot: string,
  direction: FileChangeReplayDirection,
  changes: FileChangeRecord[],
): Promise<WriteResult> {
  return runExclusiveWrite(`replay:${sessionId}:${modRoot}:${direction}`, () => applyFileChangeSet(sessionId, modRoot, direction, changes));
}
