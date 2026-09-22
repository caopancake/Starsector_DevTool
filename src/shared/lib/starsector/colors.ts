export const WEAPON_COLORS = {
  BALLISTIC: 'rgb(255 215 0)',
  ENERGY: 'rgb(70 200 255)',
  MISSILE: 'rgb(155 255 0)',
  HYBRID: 'rgb(255 165 0)',
  UNIVERSAL: 'rgb(255 255 255)',
  LAUNCH_BAY: 'rgb(60 60 194)',
  SYNERGY: 'rgb(0 255 200)',
  COMPOSITE: 'rgb(215 255 0)',
  DECORATIVE: 'rgb(160 19 19)',
  SYSTEM: 'rgb(168 168 168)',
  STATION_MODULE: 'rgb(182 50 182)',
} satisfies Record<string, string>;

export const SLOT_RADIUS = { LARGE: 32, MEDIUM: 24, SMALL: 16 } satisfies Record<string, number>;

export function rgba(color: unknown, alpha = 1): string {
  const c = Array.isArray(color) ? color : [255, 255, 255, 255];
  const a = ((Number(c[3] ?? 255) / 255) * alpha).toFixed(3);
  return `rgba(${Number(c[0] ?? 255)},${Number(c[1] ?? 255)},${Number(c[2] ?? 255)},${a})`;
}
