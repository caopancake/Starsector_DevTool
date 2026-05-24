import type { WriteResult } from '@/shared/api/write-api';
import { querySessionEntity, querySessionEntityList } from '@/services/query.service';
import { AppError, withCause } from '@/shared/lib/errors';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { uploadSprite, writeJsonSpec, type WriteResultWith } from '@/services/write.service';
import type { ProjectSessionId, ResourceRef, RowData } from '@/shared/types';

type EditorSelectOption = { label: string; value: string };

export type EditorSpriteUploadResult = WriteResultWith<{
  ok: boolean;
  exists: boolean;
  path: string;
  overwritten: boolean;
  message?: string;
}>;

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
    querySessionEntity(sessionId, 'ship', id),
    querySessionEntity(sessionId, 'weapon', id),
    querySessionEntity(sessionId, 'projectile', id),
    queryWeaponCsvRow(sessionId, id),
    queryProjectileOptions(sessionId),
  ]);
  const weaponSpec = asRowData(weapon?.data);
  const projectileId = typeof weaponSpec.projectileSpecId === 'string' ? weaponSpec.projectileSpecId : '';
  const weaponProjectile = projectileId ? await querySessionEntity(sessionId, 'projectile', projectileId) : null;
  const shipSpec = asRowData(ship?.data);
  return {
    ship: shipSpec,
    weapon: weaponSpec,
    projectile: asRowData(projectile?.data),
    weaponRow,
    weaponFiles: weaponSpec.id ? { [id]: weaponSpec } : {},
    projectiles: projectileId ? { [projectileId]: asRowData(weaponProjectile?.data) } : {},
    projectileOptions,
    weaponSpriteData: await queryWeaponSprites(sessionId, weapon?.resourceRefs ?? {}),
    shipSpriteData: await querySpriteData(sessionId, ship?.resourceRefs?.spriteName ?? null),
  };
}

export async function saveShipSpec(modRoot: string, id: string, data: RowData): Promise<WriteResult> {
  ensureSpecContext(modRoot, id, '.ship');
  data.hullId = data.hullId || id;
  try {
    return await writeJsonSpec(modRoot, 'data/hulls', 'ship', 'hullId', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.ship 失败`, error, 'save-ship-spec');
  }
}

export async function saveWeaponSpec(modRoot: string, id: string, data: RowData): Promise<WriteResult> {
  ensureSpecContext(modRoot, id, '.wpn');
  data.id = data.id || id;
  try {
    return await writeJsonSpec(modRoot, 'data/weapons', 'wpn', 'id', id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.wpn 失败`, error, 'save-weapon-spec');
  }
}

export async function saveProjectileSpec(modRoot: string, id: string, data: RowData): Promise<WriteResult> {
  ensureSpecContext(modRoot, id, '.proj');
  data.id = data.id || id;
  try {
    return await writeJsonSpec(modRoot, 'data/weapons/proj', 'proj', 'id', id, data);
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

async function queryWeaponSprites(sessionId: ProjectSessionId, refs: Record<string, ResourceRef>): Promise<Record<string, string>> {
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
    .map((field) => (refs[field] ? { field, resource: refs[field] } : null))
    .filter((entry): entry is { field: string; resource: ResourceRef } => Boolean(entry));
  if (resources.length === 0) return {};
  const dataUrls = await queryResourceDataUrlBatch(
    sessionId,
    resources.map((entry) => entry.resource),
  );
  return Object.fromEntries(dataUrls.map((dataUrl, index) => [resources[index].field, dataUrl]).filter((entry) => entry[1]));
}

async function querySpriteData(sessionId: ProjectSessionId, resource: ResourceRef | null): Promise<string> {
  if (!resource) return '';
  return (await queryResourceDataUrlBatch(sessionId, [resource]))[0] ?? '';
}

async function queryWeaponCsvRow(sessionId: ProjectSessionId, weaponId: string): Promise<RowData> {
  const weapon = await querySessionEntity(sessionId, 'weapon', weaponId);
  return asRowData(weapon?.data);
}

async function queryProjectileOptions(sessionId: ProjectSessionId): Promise<EditorSelectOption[]> {
  const projectiles = await querySessionEntityList(sessionId, 'projectile');
  return projectiles.map((projectile) => ({ label: projectile.id, value: projectile.id }));
}

function asRowData(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}

function ensureSpecContext(modRoot: string, id: string, ext: string) {
  if (!modRoot) {
    throw new AppError(`缺少 ${ext} 保存的 mod 根目录`, { action: 'save-spec' });
  }
  if (!id) {
    throw new AppError(`缺少 ${ext} 保存 id`, { action: 'save-spec' });
  }
}
