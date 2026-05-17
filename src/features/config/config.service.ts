import {
  createFaction,
  deleteFaction,
  deleteMissionDir,
  loadMission,
  loadMissionListCsv,
  saveFaction,
  saveMission,
  saveMissionListCsv,
  saveModInfo,
  scanMissionList,
} from '../../shared/api/tauri';
import { AppError, withCause } from '../../shared/lib/errors';
import type { RowData } from '../../shared/types';
import type { CsvTable, MissionData } from '../../shared/api/tauri';

export async function saveModInfoData(modRoot: string, data: RowData): Promise<void> {
  if (!modRoot) {
    throw new AppError('缺少 mod 根目录', { action: 'save-mod-info' });
  }
  try {
    await saveModInfo(modRoot, data);
  } catch (error) {
    throw withCause('保存 mod_info.json 失败', error, 'save-mod-info');
  }
}

export async function saveFactionData(modRoot: string, id: string, data: RowData): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-faction' });
  try {
    await saveFaction(modRoot, id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.faction 失败`, error, 'save-faction');
  }
}

export async function createFactionFile(modRoot: string, id: string): Promise<RowData> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'create-faction' });
  try {
    return await createFaction(modRoot, id);
  } catch (error) {
    throw withCause(`新建 ${id}.faction 失败`, error, 'create-faction');
  }
}

export async function deleteFactionFile(modRoot: string, id: string, deleteFile = false): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-faction' });
  try {
    await deleteFaction(modRoot, id, deleteFile);
  } catch (error) {
    throw withCause(`删除 ${id}.faction 失败`, error, 'delete-faction');
  }
}

export async function scanMissionListFiles(modRoot: string): Promise<string[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'scan-mission-list' });
  try {
    return await scanMissionList(modRoot);
  } catch (error) {
    throw withCause('扫描战役列表失败', error, 'scan-mission-list');
  }
}

export async function loadMissionListData(modRoot: string, relPath: string): Promise<CsvTable> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission-list' });
  try {
    return await loadMissionListCsv(modRoot, relPath);
  } catch (error) {
    throw withCause('读取 mission_list.csv 失败', error, 'load-mission-list');
  }
}

export async function saveMissionListData(modRoot: string, relPath: string, header: string[], rows: RowData[]): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-mission-list' });
  try {
    await saveMissionListCsv(modRoot, relPath, header, rows);
  } catch (error) {
    throw withCause('保存 mission_list.csv 失败', error, 'save-mission-list');
  }
}

export async function loadMissionData(modRoot: string, mission: string): Promise<MissionData> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission' });
  try {
    return await loadMission(modRoot, mission);
  } catch (error) {
    throw withCause(`读取战役 ${mission} 失败`, error, 'load-mission');
  }
}

export async function saveMissionData(modRoot: string, mission: string, descriptor: RowData, text: string): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-mission' });
  try {
    await saveMission(modRoot, mission, descriptor, text);
  } catch (error) {
    throw withCause(`保存战役 ${mission} 失败`, error, 'save-mission');
  }
}

export async function deleteMissionDirectory(modRoot: string, mission: string): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-mission-dir' });
  try {
    await deleteMissionDir(modRoot, mission);
  } catch (error) {
    throw withCause(`删除战役目录 ${mission} 失败`, error, 'delete-mission-dir');
  }
}
