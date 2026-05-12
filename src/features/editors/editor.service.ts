import { saveProjectile, saveShip, saveWeapon, uploadSprite } from '../../shared/api/tauri';
import type { RowData } from '../../shared/types';

export function saveShipSpec(modRoot: string, id: string, data: RowData): Promise<string> {
  return saveShip(modRoot, id, data);
}

export function saveWeaponSpec(modRoot: string, id: string, data: RowData): Promise<string> {
  return saveWeapon(modRoot, id, data);
}

export function saveProjectileSpec(modRoot: string, id: string, data: RowData): Promise<string> {
  return saveProjectile(modRoot, id, data);
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
