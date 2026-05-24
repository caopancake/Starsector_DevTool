import { uploadSprite } from '@/shared/api/assets-api';
import type { UploadResult } from '@/shared/api/assets-api';
import { saveJson } from '@/shared/api/files-api';
import { queryEntity, queryEntityList } from '@/shared/api/project-api';
import { AppError, withCause } from '@/shared/lib/errors';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { queryTableWindow } from '@/services/table.service';
import type { ProjectSessionId, ResourceRef, RowData } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/files-api';

type EditorSelectOption = { label: string; value: string };

export type EditorSpriteUploadResult = UploadResult;

export interface EditorEntityBundle {
  ship: RowData;
  weapon: RowData;
  projectile: RowData;
  weaponRow: RowData;
  weaponFiles: Record<string, RowData>;
  projectiles: Record<string, RowData>;
  projectileOptions: EditorSelectOption[];
  weaponSpriteData: Record<string, string>;
  shipSpriteData: string;
}

export async function queryEditorEntityBundle(sessionId: ProjectSessionId, kind: string, id: string): Promise<EditorEntityBundle> {
  const [ship, weapon, projectile, weaponRow, projectileOptions] = await Promise.all([
    queryEntity({ sessionId, kind: 'ship', id }),
    queryEntity({ sessionId, kind: 'weapon', id }),
    queryEntity({ sessionId, kind: 'projectile', id }),
    queryWeaponCsvRow(sessionId, id),
    queryProjectileOptions(sessionId),
  ]);
  const weaponSpec = asRowData(weapon?.data);
  const projectileId = typeof weaponSpec.projectileSpecId === 'string' ? weaponSpec.projectileSpecId : '';
  const weaponProjectile = projectileId ? await queryEntity({ sessionId, kind: 'projectile', id: projectileId }) : null;
  const shipSpec = asRowData(ship?.data);
  return {
    ship: shipSpec,
    weapon: weaponSpec,
    projectile: asRowData(projectile?.data),
    weaponRow,
    weaponFiles: weaponSpec.id ? { [id]: weaponSpec } : {},
    projectiles: projectileId ? { [projectileId]: asRowData(weaponProjectile?.data) } : {},
    projectileOptions,
    weaponSpriteData: await queryWeaponSprites(sessionId, kind, id, weaponSpec),
    shipSpriteData: await querySpriteData(sessionId, kind, id, strField(shipSpec.spriteName)),
  };
}

export async function saveShipSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.ship');
  data.hullId = data.hullId || id;
  try {
    return await saveJson(modRoot, 'data/hulls', 'ship', 'hullId', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.ship 失败`, error, 'save-ship-spec');
  }
}

export async function saveWeaponSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.wpn');
  data.id = data.id || id;
  try {
    return await saveJson(modRoot, 'data/weapons', 'wpn', 'id', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.wpn 失败`, error, 'save-weapon-spec');
  }
}

export async function saveProjectileSpec(modRoot: string, id: string, data: RowData): Promise<FileChangeRecord[]> {
  ensureSpecContext(modRoot, id, '.proj');
  data.id = data.id || id;
  try {
    return await saveJson(modRoot, 'data/weapons/proj', 'proj', 'id', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.proj 失败`, error, 'save-projectile-spec');
  }
}

export function uploadEditorSprite(
  modRoot: string,
  filename: string,
  data: string,
  subfolder: 'ships' | 'weapons' | 'missiles' | 'fx',
  overwrite = false,
) {
  return uploadSprite(modRoot, filename, data, subfolder, overwrite);
}

async function queryWeaponSprites(sessionId: ProjectSessionId, kind: string, id: string, weapon: RowData): Promise<Record<string, string>> {
  const fields = [
    'turretSprite',
    'turretGunSprite',
    'turretGlowSprite',
    'turretUnderSprite',
    'hardpointSprite',
    'hardpointGunSprite',
    'hardpointGlowSprite',
    'hardpointUnderSprite',
  ];
  const resources = fields
    .map((field) => {
      const sprite = strField(weapon[field]);
      return sprite ? { field, resource: resourceRef('mod', kind, id, sprite) } : null;
    })
    .filter((entry): entry is { field: string; resource: ResourceRef } => Boolean(entry));
  if (resources.length === 0) return {};
  const dataUrls = await queryResourceDataUrlBatch(
    sessionId,
    resources.map((entry) => entry.resource),
  );
  return Object.fromEntries(dataUrls.map((dataUrl, index) => [resources[index].field, dataUrl]).filter((entry) => entry[1]));
}

async function querySpriteData(sessionId: ProjectSessionId, kind: string, id: string, sprite: string): Promise<string> {
  if (!sprite) return '';
  return (await queryResourceDataUrlBatch(sessionId, [resourceRef('mod', kind, id, sprite)]))[0] ?? '';
}

async function queryWeaponCsvRow(sessionId: ProjectSessionId, weaponId: string): Promise<RowData> {
  const window = await queryTableWindow(sessionId, 'weapons', 0, 50, weaponId, null);
  return window.rows.find((row) => strField(row.row.id) === weaponId)?.row ?? {};
}

async function queryProjectileOptions(sessionId: ProjectSessionId): Promise<EditorSelectOption[]> {
  const projectiles = await queryEntityList({ sessionId, kind: 'projectile' });
  return projectiles.map((projectile) => ({ label: projectile.id, value: projectile.id }));
}

function resourceRef(source: 'mod' | 'core', ownerKind: string, ownerId: string, relPath: string): ResourceRef {
  return { source, relPath, ownerKind, ownerId, key: relPath };
}

function asRowData(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}

function strField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ensureSpecContext(modRoot: string, id: string, ext: string) {
  if (!modRoot) {
    throw new AppError(`缺少 ${ext} 保存的 mod 根目录`, { action: 'save-spec' });
  }
  if (!id) {
    throw new AppError(`缺少 ${ext} 保存 id`, { action: 'save-spec' });
  }
}
