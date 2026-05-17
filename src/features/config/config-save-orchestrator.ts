import type { FileChangeRecord } from '../../shared/api/files-api';
import type { RowData } from '../../shared/types';
import { recordFileSave } from '../file-history/file-save-orchestrator';
import {
  createFactionFile,
  deleteFactionFile,
  deleteMissionData,
  saveFactionData,
  saveMissionData,
  saveModInfoData,
} from './config-service';

export async function saveModInfoWithFileHistory(modRoot: string, data: RowData): Promise<FileChangeRecord[]> {
  const changes = await saveModInfoData(modRoot, data);
  recordConfigFileSave(modRoot, changes, '保存 mod_info.json');
  return changes;
}

export async function saveFactionWithFileHistory(
  modRoot: string,
  id: string,
  data: RowData,
  previousId?: string | null,
  deletePreviousFile = false,
): Promise<FileChangeRecord[]> {
  const changes = await saveFactionData(modRoot, id, data, previousId, deletePreviousFile);
  recordConfigFileSave(modRoot, changes, `保存 ${id}.faction`);
  return changes;
}

export async function createFactionWithFileHistory(modRoot: string, id: string): Promise<{ data: RowData; changes: FileChangeRecord[] }> {
  const result = await createFactionFile(modRoot, id);
  recordConfigFileSave(modRoot, result.changes, `创建势力 ${id}`);
  return result;
}

export async function deleteFactionWithFileHistory(modRoot: string, id: string, deleteFile = false): Promise<FileChangeRecord[]> {
  const changes = await deleteFactionFile(modRoot, id, deleteFile);
  recordConfigFileSave(modRoot, changes, `删除势力 ${id}`);
  return changes;
}

export async function saveMissionWithFileHistory(
  modRoot: string,
  mission: string,
  descriptor: RowData,
  text: string,
  missionListRelPath: string,
  header: string[],
  rows: RowData[],
  previousMissionId?: string | null,
  deletePreviousDirectory = false,
): Promise<FileChangeRecord[]> {
  const changes = await saveMissionData(
    modRoot,
    mission,
    descriptor,
    text,
    missionListRelPath,
    header,
    rows,
    previousMissionId,
    deletePreviousDirectory,
  );
  recordConfigFileSave(modRoot, changes, `保存战役 ${mission}`);
  return changes;
}

export async function deleteMissionWithFileHistory(
  modRoot: string,
  mission: string,
  missionListRelPath: string,
  header: string[],
  rows: RowData[],
  deleteMissionDirectory = false,
): Promise<FileChangeRecord[]> {
  const changes = await deleteMissionData(modRoot, mission, missionListRelPath, header, rows, deleteMissionDirectory);
  recordConfigFileSave(modRoot, changes, `删除战役列表项 ${mission}`);
  return changes;
}

function recordConfigFileSave(modRoot: string, changes: FileChangeRecord[], label: string) {
  recordFileSave(modRoot, changes, label);
}
