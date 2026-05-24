import { saveProjectileSpec, saveShipSpec, saveWeaponSpec } from '@/services/editor.service';
import type { RowData } from '@/shared/types';

export function saveShipSpecWithUserAction(modRoot: string, id: string, data: RowData) {
  return saveSpecResult(saveShipSpec(modRoot, id, data));
}

export function saveWeaponSpecWithUserAction(modRoot: string, id: string, data: RowData) {
  return saveSpecResult(saveWeaponSpec(modRoot, id, data));
}

export function saveProjectileSpecWithUserAction(modRoot: string, id: string, data: RowData) {
  return saveSpecResult(saveProjectileSpec(modRoot, id, data));
}

async function saveSpecResult(resultPromise: ReturnType<typeof saveShipSpec>) {
  const result = await resultPromise;
  return result.changes;
}
