import type { RowData } from '@/shared/types';

export type WeaponViewMode = 'turret' | 'hardpoint';

export type WeaponSpriteField =
  | 'turretSprite'
  | 'turretGunSprite'
  | 'turretGlowSprite'
  | 'turretUnderSprite'
  | 'hardpointSprite'
  | 'hardpointGunSprite'
  | 'hardpointGlowSprite'
  | 'hardpointUnderSprite';

export const TURRET_WEAPON_SPRITE_FIELDS: readonly WeaponSpriteField[] = [
  'turretSprite',
  'turretGunSprite',
  'turretGlowSprite',
  'turretUnderSprite',
];

export const HARDPOINT_WEAPON_SPRITE_FIELDS: readonly WeaponSpriteField[] = [
  'hardpointSprite',
  'hardpointGunSprite',
  'hardpointGlowSprite',
  'hardpointUnderSprite',
];

export const WEAPON_SPRITE_FIELDS: readonly WeaponSpriteField[] = [...TURRET_WEAPON_SPRITE_FIELDS, ...HARDPOINT_WEAPON_SPRITE_FIELDS];

export const WEAPON_SPRITE_DRAW_ORDER: Record<WeaponViewMode, readonly WeaponSpriteField[]> = {
  turret: ['turretUnderSprite', 'turretSprite', 'turretGunSprite', 'turretGlowSprite'],
  hardpoint: ['hardpointUnderSprite', 'hardpointSprite', 'hardpointGunSprite', 'hardpointGlowSprite'],
};

export const WEAPON_SPRITE_ORIGIN_RATIO: Record<WeaponViewMode, { x: number; y: number }> = {
  turret: { x: 0.5, y: 0.5 },
  hardpoint: { x: 0.5, y: 0.75 },
};

export function weaponOffsetsKey(mode: WeaponViewMode): string {
  return mode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
}

export function weaponAnglesKey(mode: WeaponViewMode): string {
  return mode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
}

export function weaponBarrelOffsetsFor(weapon: RowData, mode: WeaponViewMode): number[] {
  const values = weapon[weaponOffsetsKey(mode)];
  return Array.isArray(values) && values.length >= 2 ? (values as number[]) : [10, 0];
}
