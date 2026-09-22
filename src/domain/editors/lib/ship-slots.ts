import { num, str } from '@/shared/lib/starsector';
import type { RowData } from '@/shared/types';

/// Canonical default fill for a weapon slot copied/created on the canvas;
/// the preview ghost and the persisted slot must never diverge.
export function weaponSlotWithDefaults(source: RowData, id: string, locations: number[]): RowData {
  return {
    ...source,
    id,
    size: str(source.size, 'MEDIUM'),
    type: str(source.type, 'BALLISTIC'),
    mount: str(source.mount, 'TURRET'),
    arc: num(source.arc, 120),
    angle: num(source.angle, 0),
    locations,
  };
}

/// Launch bays are fixed-shape slots; only the id and position vary.
export function launchBayWithDefaults(source: RowData, id: string, locations: number[]): RowData {
  return {
    ...source,
    id,
    size: 'LARGE',
    type: 'LAUNCH_BAY',
    mount: 'HIDDEN',
    arc: 360,
    angle: 0,
    locations,
  };
}

export function engineWithDefaults(source: RowData, location: number[]): RowData {
  return {
    ...source,
    angle: num(source.angle, 180),
    contrailSize: num(source.contrailSize, 12),
    length: num(source.length, 30),
    width: num(source.width, 10),
    location,
    style: str(source.style, 'LOW_TECH'),
  };
}

/// Weapon slot ids are `WS####`, zero-padded to four digits.
export function formatWeaponSlotId(index: number): string {
  return `WS${String(index).padStart(4, '0')}`;
}

/// Launch bay ids are `LB N` with a space separator (game-facing format).
export function formatLaunchBayId(index: number): string {
  return `LB ${index}`;
}

/// Smallest unused id ≥ 1 for the given format; falls back past the scanned
/// range when every candidate is taken.
export function nextFormattedId(used: ReadonlySet<string>, format: (index: number) => string, scanLimit = 9999): string {
  for (let index = 1; index <= scanLimit; index += 1) {
    const id = format(index);
    if (!used.has(id)) return id;
  }
  return format(scanLimit + 1);
}
