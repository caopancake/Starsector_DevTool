import type { RowData } from '@/shared/types';
import { deepClone, num, str } from '@/shared/lib/starsector';

export const MIRROR_EPSILON = 0.01;

export function mirrorLateral(value: number): number {
  if (Math.abs(value) <= MIRROR_EPSILON) return 0;
  return -value;
}

export function mirrorOffsetPoint(point: number[]): number[] {
  return [point[0] || 0, mirrorLateral(point[1] || 0)];
}

export function mirrorAngleDeg(angle: number): number {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  return (360 - normalized) % 360;
}

export function isMirrorPointPair(a: number[], b: number[], epsilon = MIRROR_EPSILON): boolean {
  return Math.abs((a[0] || 0) - (b[0] || 0)) <= epsilon && Math.abs((a[1] || 0) + (b[1] || 0)) <= epsilon;
}

function rowPoint(value: unknown): number[] {
  return Array.isArray(value) ? [Number(value[0]) || 0, Number(value[1]) || 0] : [0, 0];
}

export function findMirrorWeaponSlotIndex(slots: RowData[], sourceIndex: number, epsilon = MIRROR_EPSILON): number | null {
  const source = slots[sourceIndex];
  if (!source) return null;
  const point = rowPoint(source.locations);
  if (Math.abs(point[1]) <= epsilon) return null;
  for (let index = 0; index < slots.length; index += 1) {
    if (index === sourceIndex) continue;
    const other = slots[index];
    if (!isMirrorPointPair(point, rowPoint(other.locations), epsilon)) continue;
    if (str(other.size) !== str(source.size) || str(other.type) !== str(source.type)) continue;
    return index;
  }
  return null;
}

export function findMirrorEngineIndex(engines: RowData[], sourceIndex: number, epsilon = MIRROR_EPSILON): number | null {
  const source = engines[sourceIndex];
  if (!source) return null;
  const point = rowPoint(source.location);
  if (Math.abs(point[1]) <= epsilon) return null;
  for (let index = 0; index < engines.length; index += 1) {
    if (index === sourceIndex) continue;
    const other = engines[index];
    if (!isMirrorPointPair(point, rowPoint(other.location), epsilon)) continue;
    if (num(other.length) !== num(source.length) || num(other.width) !== num(source.width)) continue;
    return index;
  }
  return null;
}

export function findMirrorBoundIndex(bounds: number[], pointIndex: number, epsilon = MIRROR_EPSILON): number | null {
  const point = rowPoint([bounds[pointIndex * 2], bounds[pointIndex * 2 + 1]]);
  if (Math.abs(point[1]) <= epsilon) return null;
  const count = Math.floor(bounds.length / 2);
  for (let index = 0; index < count; index += 1) {
    if (index === pointIndex) continue;
    if (isMirrorPointPair(point, rowPoint([bounds[index * 2], bounds[index * 2 + 1]]), epsilon)) return index;
  }
  return null;
}

export function findMirrorBarrelIndex(offsets: number[], barrelIndex: number, epsilon = MIRROR_EPSILON): number | null {
  const x = offsets[barrelIndex * 2] || 0;
  const y = offsets[barrelIndex * 2 + 1] || 0;
  if (Math.abs(x) <= epsilon) return null;
  const count = Math.floor(offsets.length / 2);
  for (let index = 0; index < count; index += 1) {
    if (index === barrelIndex) continue;
    if (Math.abs((offsets[index * 2] || 0) + x) <= epsilon && Math.abs((offsets[index * 2 + 1] || 0) - y) <= epsilon) return index;
  }
  return null;
}

export function mirrorWeaponSlotForAdd(slot: RowData): RowData {
  const clone = deepClone(slot);
  clone.locations = mirrorOffsetPoint(rowPoint(clone.locations));
  clone.angle = mirrorAngleDeg(num(clone.angle, 0));
  return clone;
}

export function mirrorEngineForAdd(engine: RowData): RowData {
  const clone = deepClone(engine);
  clone.location = mirrorOffsetPoint(rowPoint(clone.location));
  clone.angle = mirrorAngleDeg(num(clone.angle, 0));
  return clone;
}
