import { invoke } from '@tauri-apps/api/core';
import type { AppData, PersistedWorkspace, RowData, TableKey } from '../types';

export function loadModData(modRoot: string): Promise<AppData> {
  return invoke('load_mod_data', { modRoot });
}

export function saveCsv(modRoot: string, table: TableKey, header: string[], rows: RowData[]): Promise<string> {
  return invoke('save_csv', { payload: { modRoot, table, header, rows } });
}

export function addCsvRow(modRoot: string, table: TableKey, header: string[], row: RowData): Promise<void> {
  return invoke('add_csv_row', { payload: { modRoot, table, header, row } });
}

export function deleteCsvRow(modRoot: string, table: TableKey, id: string): Promise<void> {
  return invoke('delete_csv_row', { payload: { modRoot, table, id } });
}

export function addShipRow(modRoot: string, header: string[], row: RowData, ship: RowData): Promise<void> {
  return invoke('add_ship_row', { payload: { modRoot, header, row, ship } });
}

export function deleteShipRow(modRoot: string, id: string): Promise<void> {
  return invoke('delete_ship_row', { payload: { modRoot, id } });
}

export function addWeaponRow(modRoot: string, header: string[], row: RowData, weapon: RowData): Promise<void> {
  return invoke('add_weapon_row', { payload: { modRoot, header, row, weapon } });
}

export function deleteWeaponRow(modRoot: string, id: string): Promise<void> {
  return invoke('delete_weapon_row', { payload: { modRoot, id } });
}

export function saveShip(modRoot: string, id: string, data: RowData): Promise<string> {
  return invoke('save_ship', { payload: { modRoot, id, data } });
}

export function saveWeapon(modRoot: string, id: string, data: RowData): Promise<string> {
  return invoke('save_wpn', { payload: { modRoot, id, data } });
}

export function saveProjectile(modRoot: string, id: string, data: RowData): Promise<string> {
  return invoke('save_proj', { payload: { modRoot, id, data } });
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

export function saveModInfo(modRoot: string, data: RowData): Promise<void> {
  return invoke('save_mod_info', { payload: { modRoot, data } });
}

export function saveFaction(modRoot: string, id: string, data: RowData): Promise<void> {
  return invoke('save_faction', { payload: { modRoot, id, data } });
}

export function createFaction(modRoot: string, id: string): Promise<RowData> {
  return invoke('create_faction', { payload: { modRoot, id } });
}

export function deleteFaction(modRoot: string, id: string, deleteFile = false): Promise<void> {
  return invoke('delete_faction', { payload: { modRoot, id, deleteFile } });
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

export function saveMissionListCsv(modRoot: string, relPath: string, header: string[], rows: RowData[]): Promise<void> {
  return invoke('save_mission_list_csv', { payload: { modRoot, relPath, header, rows } });
}

export interface MissionData {
  descriptor: RowData;
  text: string;
  iconPath?: string | null;
}

export function loadMission(modRoot: string, mission: string): Promise<MissionData> {
  return invoke('load_mission', { payload: { modRoot, mission } });
}

export function saveMission(modRoot: string, mission: string, descriptor: RowData, text: string): Promise<void> {
  return invoke('save_mission', { payload: { modRoot, mission, descriptor, text } });
}

export function deleteMissionDir(modRoot: string, mission: string): Promise<void> {
  return invoke('delete_mission_dir', { payload: { modRoot, mission } });
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
