import type { AppData, RowData, SkinFile } from '../types';
import { cell } from './starsector';

export function resolveHullSprite(appData: AppData | null, hullId: string, origin: 'mod' | 'core' | 'both' = 'both'): string {
  const clean = hullId.trim();
  if (!appData || !clean) return '';
  if (origin === 'mod' || origin === 'both') {
    const sprite = resolveHullSpriteInSet(appData.shipSprites, appData.ships, appData.skinFiles, clean);
    if (sprite) return sprite;
  }
  if (origin === 'core' || origin === 'both') {
    const sprite = resolveHullSpriteInSet(
      appData.coreReferences.shipSprites,
      appData.coreReferences.tables.ships ?? [],
      appData.coreReferences.skinFiles,
      clean,
    );
    if (sprite) return sprite;
  }
  return '';
}

export function hullReferenceRows(appData: AppData, origin: 'mod' | 'core'): RowData[] {
  const rows = origin === 'mod' ? appData.ships : (appData.coreReferences.tables.ships ?? []);
  const skins = origin === 'mod' ? (appData.skinFiles ?? []) : (appData.coreReferences.skinFiles ?? []);
  const result: RowData[] = rows.map((row) => ({ ...row }));
  for (const skin of skins) {
    result.push({
      id: skin.skinHullId,
      hullId: skin.skinHullId,
      name: skinName(skin),
      hullName: skinName(skin),
      baseHullId: skin.baseHullId,
      tags: skin.data.tags ?? [],
      _skinHull: true,
    });
  }
  return result;
}

export function hullSpriteMap(appData: AppData, origin: 'mod' | 'core'): Record<string, string> {
  const rows = hullReferenceRows(appData, origin);
  const result: Record<string, string> = {};
  for (const row of rows) {
    const id = String(row.id ?? row.hullId ?? '').trim();
    if (!id) continue;
    const sprite = resolveHullSprite(appData, id, origin);
    if (sprite) result[id] = sprite;
  }
  return result;
}

export function wingSpriteMap(
  appData: AppData,
  rows: RowData[],
  variants: AppData['variantFiles'],
  origin: 'mod' | 'core',
): Record<string, string> {
  const byVariantId = new Map(variants.map((variant) => [variant.variantId, variant.hullId]));
  const byRelPath = new Map(variants.map((variant) => [variant.relPath, variant.hullId]));
  const result: Record<string, string> = {};
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    const variantRef = String(row.variant ?? '')
      .trim()
      .replace(/\\/g, '/');
    if (!id || !variantRef) continue;
    const stem = variantRef
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/\.variant$/i, '');
    const hullId = byVariantId.get(variantRef) ?? (stem ? byVariantId.get(stem) : undefined) ?? byRelPath.get(variantRef);
    const sprite = hullId ? resolveHullSprite(appData, hullId, origin) : '';
    if (sprite) result[id] = sprite;
  }
  return result;
}

function resolveHullSpriteInSet(sprites: Record<string, string>, ships: RowData[], skins: SkinFile[], hullId: string): string {
  const direct = sprites[hullId];
  if (direct) return direct;
  const skin = (skins ?? []).find((item) => item.skinHullId === hullId);
  if (skin) {
    const skinSprite = sprites[skin.skinHullId];
    if (skinSprite) return skinSprite;
    return resolveHullSpriteInSet(sprites, ships, skins, skin.baseHullId);
  }
  const row = ships.find((ship) => cell(ship.id) === hullId || cell(ship.hullId) === hullId);
  const shipId = cell(row?.id) || cell(row?.hullId);
  return shipId ? sprites[shipId] || '' : '';
}

function skinName(skin: SkinFile): string {
  return cell(skin.data.hullName) || skin.skinHullId;
}
