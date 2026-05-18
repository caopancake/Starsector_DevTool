import { invoke } from '@tauri-apps/api/core';
import type { RowData } from '../types';
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
