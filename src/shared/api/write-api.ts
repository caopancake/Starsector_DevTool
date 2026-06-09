import { invoke } from '@tauri-apps/api/core';
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
  ProjectSessionId,
  RowData,
  SkinEntityWrite,
  SpriteSubfolder,
  TableKey,
  VariantEntityWrite,
  WriteResult,
} from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types/editor.types';

export function saveCsvPatch(
  sessionId: ProjectSessionId,
  modRoot: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedSpecs: AssociatedSpecChange[],
): Promise<WriteResult> {
  return invoke('save_csv_patch', { payload: { sessionId, modRoot, table, patches, associatedSpecs } });
}

export function saveTextFile(sessionId: ProjectSessionId, modRoot: string, path: string, text: string): Promise<WriteResult> {
  return invoke('save_text_file', { payload: { sessionId, modRoot, path, text } });
}

export function saveEditorSpec(
  sessionId: ProjectSessionId,
  modRoot: string,
  kind: EditorSpecKind,
  id: string,
  data: RowData,
): Promise<WriteResult> {
  return invoke('save_editor_spec', { payload: { sessionId, modRoot, kind, id, data } });
}

export function saveModFiles(sessionId: ProjectSessionId, modRoot: string, files: AssociatedFileChange[]): Promise<WriteResult> {
  return invoke('save_mod_files', { payload: { sessionId, modRoot, files } });
}

export function applyFileChangeSet(
  sessionId: ProjectSessionId,
  modRoot: string,
  direction: FileChangeReplayDirection,
  changes: FileChangeRecord[],
): Promise<WriteResult> {
  return invoke('apply_file_change_set', { payload: { sessionId, modRoot, direction, changes } });
}

export function uploadSprite(
  sessionId: ProjectSessionId,
  modRoot: string,
  filename: string,
  data: string,
  subfolder: SpriteSubfolder,
  overwrite: boolean,
): Promise<WriteResult> {
  return invoke('upload_sprite', { payload: { sessionId, modRoot, filename, data, subfolder, overwrite } });
}

export function saveIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('save_indexed_config_entity', {
    payload: {
      modRoot: write.modRoot,
      sessionId: write.sessionId,
      kind: write.kind,
      previousId: write.previousId,
      nextId: write.nextId,
      indexRow: write.indexRow,
      entityData: write.entityData,
      deletePreviousTarget: write.deletePreviousTarget,
    },
  });
}

export function createIndexedConfigEntity(write: IndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('create_indexed_config_entity', {
    payload: {
      modRoot: write.modRoot,
      sessionId: write.sessionId,
      kind: write.kind,
      previousId: write.previousId,
      nextId: write.nextId,
      indexRow: write.indexRow,
      entityData: write.entityData,
      deletePreviousTarget: write.deletePreviousTarget,
    },
  });
}

export function deleteIndexedConfigEntity(write: DeleteIndexedConfigEntityWrite): Promise<WriteResult> {
  return invoke('delete_indexed_config_entity', { payload: write });
}

export function saveVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return invoke('save_variant_entity', { payload: write });
}

export function createVariantEntity(write: VariantEntityWrite): Promise<WriteResult> {
  return invoke('create_variant_entity', { payload: write });
}

export function deleteVariantEntity(write: DeleteVariantEntityWrite): Promise<WriteResult> {
  return invoke('delete_variant_entity', { payload: write });
}

export function saveSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return invoke('save_skin_entity', { payload: write });
}

export function createSkinEntity(write: SkinEntityWrite): Promise<WriteResult> {
  return invoke('create_skin_entity', { payload: write });
}

export function deleteSkinEntity(write: DeleteSkinEntityWrite): Promise<WriteResult> {
  return invoke('delete_skin_entity', { payload: write });
}
