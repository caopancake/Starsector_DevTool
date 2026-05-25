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
