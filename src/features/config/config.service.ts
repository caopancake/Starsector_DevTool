import { createFaction, deleteFaction, saveFaction, saveModInfo } from '../../shared/api/tauri';
import { AppError, withCause } from '../../shared/lib/errors';
import type { RowData } from '../../shared/types';

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

export async function deleteFactionFile(modRoot: string, id: string): Promise<void> {
  if (!modRoot) throw new AppError('缺少 mod 根目录', { action: 'delete-faction' });
  try {
    await deleteFaction(modRoot, id);
  } catch (error) {
    throw withCause(`删除 ${id}.faction 失败`, error, 'delete-faction');
  }
}
