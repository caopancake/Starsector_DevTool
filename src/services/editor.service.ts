import { uploadSprite } from '@/shared/api/assets-api';
import type { UploadResult } from '@/shared/api/assets-api';
import { saveJson } from '@/shared/api/files-api';
import { AppError, withCause } from '@/shared/lib/errors';
import type { RowData } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

export type EditorSpriteUploadResult = UploadResult;

export async function saveShipSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.ship');
  data.hullId = data.hullId || id;
  try {
    return await saveJson(modRoot, 'data/hulls', 'ship', 'hullId', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.ship 失败`, error, 'save-ship-spec');
  }
}

export async function saveWeaponSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.wpn');
  data.id = data.id || id;
  try {
    return await saveJson(modRoot, 'data/weapons', 'wpn', 'id', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.wpn 失败`, error, 'save-weapon-spec');
  }
}

export async function saveProjectileSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.proj');
  data.id = data.id || id;
  try {
    return await saveJson(modRoot, 'data/weapons/proj', 'proj', 'id', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.proj 失败`, error, 'save-projectile-spec');
  }
}

export function uploadEditorSprite(
  modRoot: string,
  filename: string,
  data: string,
  subfolder: 'ships' | 'weapons' | 'missiles' | 'fx',
  overwrite = false,
) {
  return uploadSprite(modRoot, filename, data, subfolder, overwrite);
}

function ensureSpecContext(modRoot: string, id: string, ext: string) {
  if (!modRoot) {
    throw new AppError(`缺少 ${ext} 保存的 mod 根目录`, { action: 'save-spec' });
  }
  if (!id) {
    throw new AppError(`缺少 ${ext} 保存 id`, { action: 'save-spec' });
  }
}
