import { invoke } from '@tauri-apps/api/core';
import type { RowData } from '../types';
import type { FileChangeRecord } from './files-api';
import type { CsvTable } from './tables-api';

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
