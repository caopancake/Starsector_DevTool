import type { RowData } from '../../../shared/types';
import { deepClone } from '../../../shared/lib/starsector';

export function normalizeShipSpec(ship: RowData): RowData {
  const normalized = deepClone(ship);
  normalized.weaponSlots = Array.isArray(normalized.weaponSlots) ? normalized.weaponSlots : [];
  normalized.engineSlots = Array.isArray(normalized.engineSlots) ? normalized.engineSlots : [];
  normalized.bounds = Array.isArray(normalized.bounds) ? normalized.bounds : [];
  normalized.builtInMods = Array.isArray(normalized.builtInMods) ? normalized.builtInMods : [];
  normalized.builtInWings = Array.isArray(normalized.builtInWings) ? normalized.builtInWings : [];
  normalized.builtInWeapons = normalized.builtInWeapons && typeof normalized.builtInWeapons === 'object' ? normalized.builtInWeapons : {};
  return normalized;
}

export function normalizeWeaponSpec(weapon: RowData): RowData {
  const normalized = deepClone(weapon);
  for (const key of ['turretOffsets', 'hardpointOffsets', 'turretAngleOffsets', 'hardpointAngleOffsets']) {
    normalized[key] = Array.isArray(normalized[key]) ? normalized[key] : [];
  }
  return normalized;
}

export function normalizeProjectileSpec(projectile: RowData): RowData {
  const normalized = deepClone(projectile);
  normalized.engineSlots = Array.isArray(normalized.engineSlots) ? normalized.engineSlots : [];
  return normalized;
}
