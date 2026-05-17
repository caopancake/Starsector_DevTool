import { invoke } from '@tauri-apps/api/core';
import type { AppData, GameOverviewData, OpenDirectoryResult, PersistedWorkspace, RowData, TableKey } from '../types';

export function loadModData(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
  if (starsectorRoot) {
    return invoke('load_mod_data_with_root', { modRoot, starsectorRoot });
  }
  return invoke('load_mod_data', { modRoot });
}

export function detectDirectory(path: string, fallbackStarsectorRoot?: string | null): Promise<OpenDirectoryResult> {
  return invoke('detect_directory', { path, fallbackStarsectorRoot: fallbackStarsectorRoot ?? null });
}

export function scanGameOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return invoke('scan_game_overview', { starsectorRoot });
}

export interface AssociatedFileChange {
  relPath: string;
  afterText?: string | null;
}

export function saveCsvWithHistory(
  modRoot: string,
  table: TableKey,
  header: string[],
  rows: RowData[],
  associatedFiles: AssociatedFileChange[] = [],
): Promise<FileChangeRecord[]> {
  return invoke('save_csv_with_history', { payload: { modRoot, table, header, rows, associatedFiles } });
}

export interface UploadResult {
  ok: boolean;
  exists: boolean;
  path: string;
  overwritten: boolean;
  message?: string;
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

export function loadWorkspace(): Promise<PersistedWorkspace> {
  return invoke('load_workspace');
}

export function saveWorkspace(state: PersistedWorkspace): Promise<void> {
  return invoke('save_workspace', { state });
}

export interface CsvTable {
  header: string[];
  rows: RowData[];
  path: string;
}

export function scanMissionList(modRoot: string): Promise<string[]> {
  return invoke('scan_mission_list', { modRoot });
}

export function loadMissionListCsv(modRoot: string, relPath: string): Promise<CsvTable> {
  return invoke('load_mission_list_csv', { payload: { modRoot, relPath } });
}

export interface MissionData {
  descriptor: RowData;
  text: string;
  iconPath?: string | null;
}

export function loadMission(modRoot: string, mission: string): Promise<MissionData> {
  return invoke('load_mission', { payload: { modRoot, mission } });
}

export interface FactionHistoryResult {
  data?: RowData | null;
  changes: FileChangeRecord[];
}

export function createFactionWithHistory(modRoot: string, id: string): Promise<FactionHistoryResult> {
  return invoke('create_faction_with_history', { payload: { modRoot, id } });
}

export function saveFactionWithHistory(
  modRoot: string,
  id: string,
  data: RowData,
  oldId?: string | null,
  deleteOldFile = false,
): Promise<FileChangeRecord[]> {
  return invoke('save_faction_with_history', { payload: { modRoot, id, oldId: oldId ?? null, data, deleteFile: deleteOldFile } });
}

export function deleteFactionWithHistory(modRoot: string, id: string, deleteFile = false): Promise<FileChangeRecord[]> {
  return invoke('delete_faction_with_history', { payload: { modRoot, id, deleteFile } });
}

export function saveMissionWithHistory(
  modRoot: string,
  mission: string,
  descriptor: RowData,
  text: string,
  missionListRelPath: string,
  header: string[],
  rows: RowData[],
  oldMission?: string | null,
  deleteOldDirectory = false,
): Promise<FileChangeRecord[]> {
  return invoke('save_mission_with_history', {
    payload: {
      modRoot,
      mission,
      oldMission: oldMission ?? null,
      descriptor,
      text,
      missionListRelPath,
      header,
      rows,
      deleteOldDirectory,
    },
  });
}

export function deleteMissionWithHistory(
  modRoot: string,
  mission: string,
  missionListRelPath: string,
  header: string[],
  rows: RowData[],
  deleteDirectory = false,
): Promise<FileChangeRecord[]> {
  return invoke('delete_mission_with_history', {
    payload: {
      modRoot,
      mission,
      missionListRelPath,
      header,
      rows,
      deleteOldDirectory: deleteDirectory,
    },
  });
}

export function loadImageDataUrl(modRoot: string, relPath: string, starsectorRoot?: string): Promise<string | null> {
  return invoke('load_image_data_url', { modRoot, relPath, starsectorRoot: starsectorRoot ?? null });
}

export interface DiscoveredField {
  key: string;
  type: string;
  origin: string;
}

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return invoke('scan_core_fields', { starsectorRoot });
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return invoke('scan_core_graphics', { starsectorRoot });
}

export interface EditableFileData {
  path: string;
  text: string;
}

export function loadEditableFile(path: string): Promise<EditableFileData> {
  return invoke('load_editable_file', { path });
}

export interface FileChangeRecord {
  kind: 'file' | 'directory';
  path: string;
  beforeExists: boolean;
  beforeText?: string | null;
  beforeFiles: FileSnapshot[];
  afterExists: boolean;
  afterText?: string | null;
  afterFiles: FileSnapshot[];
}

export interface FileSnapshot {
  relPath: string;
  text?: string | null;
  dataBase64?: string | null;
}

export function saveTextFileWithHistory(path: string, text: string): Promise<FileChangeRecord[]> {
  return invoke('save_text_file_with_history', { payload: { path, text } });
}

export function saveJsonWithHistory(
  modRoot: string,
  relDir: string,
  ext: string,
  idKey: string,
  id: string,
  data: RowData,
): Promise<FileChangeRecord[]> {
  return invoke('save_json_with_history', { payload: { modRoot, relDir, ext, idKey, id, data } });
}

export function saveModFilesWithHistory(modRoot: string, files: AssociatedFileChange[]): Promise<FileChangeRecord[]> {
  return invoke('save_mod_files_with_history', { payload: { modRoot, files } });
}

export function applyFileChangeSet(direction: 'undo' | 'redo', changes: FileChangeRecord[]): Promise<void> {
  return invoke('apply_file_change_set', { payload: { direction, changes } });
}
