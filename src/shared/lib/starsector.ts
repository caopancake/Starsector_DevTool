import type { JsonValue, RowData, TableKey } from '@/shared/types';
import { isInternalJsonFieldKey } from '@/shared/lib/json-fields';

export const TABLE_COLUMNS: Record<TableKey, string[]> = {
  ships: [
    'name',
    'id',
    'designation',
    'system id',
    'hitpoints',
    'armor rating',
    'shield type',
    'shield arc',
    'shield efficiency',
    'max flux',
    'flux dissipation',
    'max speed',
    'ordnance points',
    'fleet pts',
    'fighter bays',
    'cargo',
    'fuel',
    'min crew',
    'max crew',
    'tags',
  ],
  weapons: [
    'name',
    'id',
    'type',
    'range',
    'damage/shot',
    'damage/second',
    'emp',
    'OPs',
    'proj speed',
    'ammo',
    'ammo/sec',
    'reload size',
    'energy/shot',
    'energy/second',
    'chargeup',
    'chargedown',
    'burst size',
    'burst delay',
    'min spread',
    'max spread',
    'beam speed',
    'launch speed',
    'flight time',
    'hints',
    'tags',
  ],
  wings: ['id', 'variant', 'tags', 'op cost', 'num', 'role', 'role desc', 'refit', 'formation', 'range'],
  hullmods: [
    'name',
    'id',
    'tier',
    'tags',
    'uiTags',
    'cost_frigate',
    'cost_dest',
    'cost_cruiser',
    'cost_capital',
    'script',
    'desc',
    'short',
    'sModDesc',
    'sprite',
  ],
  shipSystems: [
    'name',
    'id',
    'flux/second',
    'f/s (base rate)',
    'f/s (base cap)',
    'flux/use',
    'f/u (base rate)',
    'f/u (base cap)',
    'cr/u',
    'max uses',
    'regen',
    'charge up',
    'active',
    'down',
    'cooldown',
    'toggle',
    'noDissipation',
    'noHardDissipation',
    'hardFlux',
    'noFiring',
    'noTurning',
    'noStrafing',
    'noAccel',
    'noShield',
    'noVent',
    'isPhaseCloak',
    'tags',
    'icon',
  ],
  industries: ['name', 'id', 'build time', 'upkeep', 'tags', 'desc', 'order'],
  skills: ['id', 'name', 'icon', 'description', 'aptitude', 'tier', 'tags'],
  abilities: ['name', 'id', 'type', 'tags', 'icon', 'desc', 'sortOrder', 'unlockedAtStart', 'defaultForAIFleet'],
  commodities: ['name', 'id', 'icon', 'price', 'order', 'econUnit', 'tags'],
  specialItems: [
    'name',
    'id',
    'tags',
    'tech/manufacturer',
    'rarity',
    'base price',
    'stack size',
    'cargo space',
    'baseRaidDanger',
    'icon',
    'plugin',
    'plugin params',
    'desc',
    'order',
  ],
  submarkets: ['id', 'name', 'faction', 'desc', 'script', 'icon', 'order'],
  marketConditions: ['name', 'id', 'tags', 'planetary', 'decivRemove', 'script', 'desc', 'icon', 'order'],
  simOpponents: ['variant id'],
  descriptions: ['id', 'type', 'text1', 'text2', 'text3', 'text4', 'text5', 'notes'],
};

export const MODULE_LABELS: Record<TableKey, string> = {
  ships: '舰船',
  weapons: '武器',
  wings: '联队',
  hullmods: '舰船插件',
  shipSystems: '战术系统',
  industries: '工业',
  skills: '技能',
  abilities: '舰队能力',
  commodities: '贸易商品',
  specialItems: '特殊物品',
  submarkets: '市场类型',
  marketConditions: '市场条件',
  simOpponents: '模拟对手',
  descriptions: '描述文本',
};

export const WEAPON_COLORS: Record<string, string> = {
  BALLISTIC: 'rgb(255 215 0)',
  ENERGY: 'rgb(70 200 255)',
  MISSILE: 'rgb(155 255 0)',
  HYBRID: 'rgb(255 165 0)',
  UNIVERSAL: 'rgb(255 255 255)',
  LAUNCH_BAY: '#3c3cc2',
  SYNERGY: 'rgb(0 255 200)',
  COMPOSITE: 'rgb(215 255 0)',
  DECORATIVE: '#a01313',
  SYSTEM: '#a8a8a8',
  STATION_MODULE: '#b632b6',
};

export const SLOT_RADIUS: Record<string, number> = { LARGE: 32, MEDIUM: 24, SMALL: 16 };

export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }
  if (value && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = deepClone(item);
    }
    return clone as T;
  }
  return value;
}

export function cell(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function formatModVersion(value: JsonValue | undefined): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const major = value.major;
    const minor = value.minor;
    const patch = value.patch;
    if (typeof major === 'number' && typeof minor === 'number' && typeof patch === 'number') {
      return `${major}.${minor}.${patch}`;
    }
  }
  return cell(value);
}

export function num(value: JsonValue | undefined, defaultValue = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(cell(value));
  return Number.isFinite(n) ? n : defaultValue;
}

export function str(value: JsonValue | undefined, defaultValue = ''): string {
  const s = cell(value);
  return s || defaultValue;
}

export function arr(value: JsonValue | undefined, defaultValue: number[] = []): number[] {
  return Array.isArray(value) ? value.map((v) => num(v)) : [...defaultValue];
}

export function rowDisplayId(row: RowData): string {
  return str(row.id) || str(row.hullId) || str(row['variant id']) || str(row.name);
}

export function isDisabledCsvReference(value: string): boolean {
  return value.trim().startsWith('#');
}

function referenceableCsvId(value: string): string {
  return isDisabledCsvReference(value) ? '' : value;
}

export function rowSpecId(row: RowData, tab?: TableKey): string {
  if (tab === 'ships') return referenceableCsvId(str(row.id)) || referenceableCsvId(str(row.hullId));
  if (tab === 'weapons' || tab === 'shipSystems' || tab === 'skills') return referenceableCsvId(str(row.id));
  return referenceableCsvId(str(row.id)) || referenceableCsvId(str(row.hullId));
}

export function getColumns(tab: TableKey, headers: string[]): string[] {
  const priority = TABLE_COLUMNS[tab] || [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const col of priority) {
    if (headers.includes(col) && !seen.has(col)) {
      result.push(col);
      seen.add(col);
    }
  }
  for (const col of headers) {
    if (col && !isInternalJsonFieldKey(col) && !seen.has(col)) {
      result.push(col);
      seen.add(col);
    }
  }
  return result;
}

export function defaultShip(id: string): RowData {
  return {
    hullId: id,
    hullName: id,
    hullSize: 'FRIGATE',
    style: 'LOW_TECH',
    width: 100,
    height: 150,
    center: [50, 75],
    collisionRadius: 80,
    shieldCenter: [0, 0],
    shieldRadius: 60,
    spriteName: '',
    viewOffset: 0,
    weaponSlots: [],
    engineSlots: [],
    bounds: [-60, -30, -60, 30, 60, 30, 60, -30],
    builtInMods: [],
    builtInWeapons: {},
    builtInWings: [],
  };
}

export function defaultWeapon(id: string, csvRow?: RowData): RowData {
  const hasBeam = Boolean(str(csvRow?.['beam speed']));
  const data: RowData = {
    id,
    specClass: hasBeam ? 'beam' : 'projectile',
    type: str(csvRow?.type, 'BALLISTIC').toUpperCase(),
    size: 'SMALL',
    turretSprite: '',
    turretGunSprite: '',
    hardpointSprite: '',
    hardpointGunSprite: '',
    turretOffsets: [10, 0],
    turretAngleOffsets: [0],
    hardpointOffsets: [15, 0],
    hardpointAngleOffsets: [0],
    barrelMode: 'ALTERNATING',
    animationType: 'MUZZLE_FLASH',
    projectileSpecId: '',
    fireSoundTwo: '',
  };
  if (hasBeam) {
    data.fringeColor = [100, 200, 255, 200];
    data.coreColor = [255, 255, 255, 255];
    data.glowColor = [100, 200, 255, 100];
    data.width = 10;
  }
  return data;
}

export function rgba(color: unknown, alpha = 1): string {
  const c = Array.isArray(color) ? color : [255, 255, 255, 255];
  const a = ((Number(c[3] ?? 255) / 255) * alpha).toFixed(3);
  return `rgba(${Number(c[0] ?? 255)},${Number(c[1] ?? 255)},${Number(c[2] ?? 255)},${a})`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}
