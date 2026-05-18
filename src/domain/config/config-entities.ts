import type { JsonValue, RowData } from '@/shared/types';

export function createDefaultVariant(hullId: string, variantId: string): RowData {
  return {
    variantId,
    hullId,
    displayName: variantId,
    goalVariant: false,
    fluxVents: 0,
    fluxCapacitors: 0,
    hullMods: [],
    permaMods: [],
    sMods: [],
    weaponGroups: [],
    wings: [],
  };
}

export function createDefaultSkin(baseHullId: string, skinHullId: string): RowData {
  return {
    skinHullId,
    baseHullId,
    hullName: skinHullId,
    descriptionId: '',
    descriptionPrefix: '',
    tags: [],
    removeHints: [],
    addHints: [],
    removeBuiltInMods: [],
    builtInMods: [],
    removeBuiltInWeapons: [],
    removeWeaponSlots: [],
    removeEngineSlots: [],
    builtInWeapons: {},
    builtInWings: [],
    weaponSlotChanges: {},
    engineSlotChanges: {},
  };
}

export function createDefaultFaction(id: string): RowData {
  return {
    id,
    displayName: id,
    displayNameLong: id,
    color: [128, 128, 128, 255],
    baseColor: [128, 128, 128, 255],
    darkColor: [64, 64, 64, 255],
    shipNamePrefix: '',
    knownShips: { tags: [] },
    knownWeapons: { tags: [] },
    knownFighters: { tags: [] },
  };
}

export function buildFactionIndexRow(id: string): RowData {
  return {
    id,
    file: `data/world/factions/${id}.faction`,
  };
}

export function buildMissionIndexRow(rows: RowData[], header: string[], mission: string): RowData {
  const row = rows.find((item) => String(item.mission ?? '').trim() === mission) ?? {};
  const result: RowData = {};
  for (const col of header.length ? header : ['mission']) {
    result[col] = row[col] ?? '';
  }
  for (const [key, value] of Object.entries(row)) {
    if (!(key in result)) result[key] = value;
  }
  result.mission = mission;
  return result;
}

export function isSafeEntityFileStem(value: string): boolean {
  return value.length > 0 && !value.includes('/') && !value.includes('\\') && value !== '.' && value !== '..' && !value.includes('..');
}

export function stripSchemaInternalFields(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stripSchemaInternalFields);
  if (!value || typeof value !== 'object') return value;
  const result: RowData = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    result[key] = stripSchemaInternalFields(item);
  }
  return result;
}
