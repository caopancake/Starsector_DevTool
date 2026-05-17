import {
  createFactionWithHistory,
  deleteFactionWithHistory,
  deleteMissionWithHistory,
  loadMission,
  loadMissionListCsv,
  saveModFilesWithHistory,
  saveFactionWithHistory,
  saveMissionWithHistory,
  scanMissionList,
} from '../../shared/api/tauri';
import { AppError, withCause } from '../../shared/lib/errors';
import type { RowData } from '../../shared/types';
import type { AssociatedFileChange, CsvTable, FileChangeRecord, MissionData } from '../../shared/api/tauri';

export async function saveModInfoData(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  if (!modRoot) {
    throw new AppError('缺少 mod 根目录', { action: 'save-mod-info' });
  }
  try {
    return await saveModFilesWithHistory(modRoot, [
      { relPath: 'mod_info.json', afterText: JSON.stringify(stripInternalFields(data), null, 2) },
    ]);
  } catch (error) {
    throw withCause('保存 mod_info.json 失败', error, 'save-mod-info');
  }
}

export async function saveFactionData(
  modRoot: string,
  id: string,
  data: RowData,
  oldId?: string | null,
  deleteOldFile = false,
): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-faction' });
  try {
    return await saveFactionWithHistory(modRoot, id, stripInternalFields(data), oldId, deleteOldFile);
  } catch (error) {
    throw withCause(`保存 ${id}.faction 失败`, error, 'save-faction');
  }
}

export async function createFactionFile(modRoot: string, id: string): Promise<{ data: RowData; changes: FileChangeRecord[] }> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'create-faction' });
  try {
    const result = await createFactionWithHistory(modRoot, id);
    return { data: result.data ?? {}, changes: result.changes };
  } catch (error) {
    throw withCause(`新建 ${id}.faction 失败`, error, 'create-faction');
  }
}

export async function deleteFactionFile(modRoot: string, id: string, deleteFile = false): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-faction' });
  try {
    return await deleteFactionWithHistory(modRoot, id, deleteFile);
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

export async function loadMissionData(modRoot: string, mission: string): Promise<MissionData> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'load-mission' });
  try {
    return await loadMission(modRoot, mission);
  } catch (error) {
    throw withCause(`读取战役 ${mission} 失败`, error, 'load-mission');
  }
}

export async function saveConfigFilesData(modRoot: string, files: AssociatedFileChange[]): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-config-files' });
  try {
    return await saveModFilesWithHistory(modRoot, files);
  } catch (error) {
    throw withCause('保存配置文件失败', error, 'save-config-files');
  }
}

export async function saveMissionDataWithHistory(
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
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'save-mission' });
  try {
    return await saveMissionWithHistory(
      modRoot,
      mission,
      stripInternalFields(descriptor),
      text,
      missionListRelPath,
      header,
      rows,
      oldMission,
      deleteOldDirectory,
    );
  } catch (error) {
    throw withCause(`保存战役 ${mission} 失败`, error, 'save-mission');
  }
}

export async function deleteMissionDataWithHistory(
  modRoot: string,
  mission: string,
  missionListRelPath: string,
  header: string[],
  rows: RowData[],
  deleteDirectory = false,
): Promise<FileChangeRecord[]> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-mission' });
  try {
    return await deleteMissionWithHistory(modRoot, mission, missionListRelPath, header, rows, deleteDirectory);
  } catch (error) {
    throw withCause(`删除战役 ${mission} 失败`, error, 'delete-mission');
  }
}

function stripInternalFields(value: RowData): RowData {
  const result: RowData = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    result[key] = item;
  }
  return result;
}
