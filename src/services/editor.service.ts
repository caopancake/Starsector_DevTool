import { querySessionEntity, querySessionEntityList } from '@/services/query.service';
import { AppError, withCause } from '@/shared/lib/errors';
import { queryResourceDataUrls } from '@/services/resource-cache.service';
import { writeEditorSpec, writeSpriteUpload } from '@/services/write.service';
import { WEAPON_SPRITE_FIELDS } from '@/domain/editors/lib/weapon-sprite-fields';
import { editorSpecExtension } from '@/domain/editors/editor-kind-metadata';
import { requireRowData } from '@/shared/lib/row-data';
import { defaultShip } from '@/shared/lib/starsector';
import { loadJsonSpecFile } from '@/shared/api/files-api';
import type {
  EditorSpecKind,
  EditorWindowKind,
  EntityData,
  ProjectSessionId,
  ResourceRef,
  RowData,
  SpriteSubfolder,
  SpriteUploadResult,
  SpriteUploadState,
  WriteResult,
} from '@/shared/types';

type EditorSelectOption = { label: string; value: string };

export type EditorEntityBundle =
  | ShipEditorEntityBundle
  | WeaponEditorEntityBundle
  | ProjectileEditorEntityBundle
  | SystemEditorEntityBundle
  | WeaponPreviewEntityBundle;

export interface ShipEditorEntityBundle {
  kind: 'ship';
  ship: RowData;
  shipSpriteData: string;
  isNew: boolean;
}

export interface WeaponEditorEntityBundle {
  kind: 'weapon';
  weapon: RowData;
  weaponCsvRow: RowData;
  projectileSpecs: Record<string, RowData>;
  projectileOptions: EditorSelectOption[];
  weaponSpriteData: Record<string, string>;
  isNew: boolean;
}

export interface WeaponPreviewEntityBundle {
  kind: 'weapon-preview';
  weapon: RowData;
  weaponCsvRow: RowData;
  projectileSpecs: Record<string, RowData>;
  weaponSpriteData: Record<string, string>;
  isNew: boolean;
}

export interface ProjectileEditorEntityBundle {
  kind: 'projectile';
  projectile: RowData;
  projectileSpecs: Record<string, RowData>;
  isNew: boolean;
}

export interface SystemEditorEntityBundle {
  kind: 'system';
  system: RowData;
  isNew: boolean;
}

export async function queryEditorEntityBundle(
  sessionId: ProjectSessionId,
  kind: EditorWindowKind,
  id: string,
): Promise<EditorEntityBundle> {
  return EDITOR_ENTITY_BUNDLE_LOADERS[kind](sessionId, id);
}

const EDITOR_ENTITY_BUNDLE_LOADERS: Record<EditorWindowKind, (sessionId: ProjectSessionId, id: string) => Promise<EditorEntityBundle>> = {
  ship: queryShipEditorBundle,
  weapon: (sessionId, id) => queryWeaponEditorBundle(sessionId, id),
  projectile: queryProjectileEditorBundle,
  system: querySystemEditorBundle,
  'weapon-preview': queryWeaponPreviewBundle,
};

async function queryShipEditorBundle(sessionId: ProjectSessionId, id: string): Promise<ShipEditorEntityBundle> {
  const ship = await querySessionEntity(sessionId, 'ship', id);
  const shipSpec = ship ? requireEditorRowData(ship.data, `舰船 ${id} 数据无效`) : defaultShipSpec(id);
  return {
    kind: 'ship',
    ship: shipSpec,
    shipSpriteData: ship ? await querySpriteData(sessionId, ship.resourceRefs.sprite ?? null) : '',
    isNew: !ship,
  };
}

async function queryWeaponEditorBundle(sessionId: ProjectSessionId, id: string): Promise<WeaponEditorEntityBundle> {
  const bundle = await queryWeaponLikeBundle(sessionId, id);
  return {
    kind: 'weapon',
    ...bundle,
    projectileOptions: await queryProjectileOptions(sessionId),
  };
}

async function queryWeaponPreviewBundle(sessionId: ProjectSessionId, id: string): Promise<WeaponPreviewEntityBundle> {
  return {
    kind: 'weapon-preview',
    ...(await queryWeaponLikeBundle(sessionId, id)),
  };
}

async function queryWeaponLikeBundle(
  sessionId: ProjectSessionId,
  id: string,
): Promise<Omit<WeaponEditorEntityBundle, 'kind' | 'projectileOptions'>> {
  const weapon = requireEditorEntity(await querySessionEntity(sessionId, 'weapon', id), 'weapon', id);
  const weaponEntity = requireEditorRowData(weapon.data, `武器 ${id} 数据无效`);
  const weaponSpec = requireEditorRowData(weaponEntity.spec, `武器 ${id} spec 数据无效`);
  const weaponCsvRow = requireEditorRowData(weaponEntity.csvRow, `武器 ${id} CSV 数据无效`);
  const isNew = Object.keys(weaponSpec).length === 0;
  const projectileId = typeof weaponSpec.projectileSpecId === 'string' ? weaponSpec.projectileSpecId : '';
  const weaponProjectile = projectileId ? await querySessionEntity(sessionId, 'projectile', projectileId) : null;
  return {
    weapon: weaponSpec,
    weaponCsvRow,
    isNew,
    projectileSpecs: weaponProjectile
      ? { [projectileId]: requireEditorRowData(weaponProjectile.data, `弹体 ${projectileId} 数据无效`) }
      : {},
    weaponSpriteData: await queryWeaponSprites(sessionId, weapon.resourceRefs),
  };
}

async function queryProjectileEditorBundle(sessionId: ProjectSessionId, id: string): Promise<ProjectileEditorEntityBundle> {
  const projectile = await querySessionEntity(sessionId, 'projectile', id);
  const spec = projectile ? requireEditorRowData(projectile.data, `弹体 ${id} 数据无效`) : defaultProjectileSpec(id);
  return {
    kind: 'projectile',
    projectile: spec,
    projectileSpecs: { [id]: spec },
    isNew: !projectile,
  };
}

async function querySystemEditorBundle(sessionId: ProjectSessionId, id: string): Promise<SystemEditorEntityBundle> {
  const system = await querySessionEntity(sessionId, 'system', id);
  return {
    kind: 'system',
    system: system ? requireEditorRowData(system.data, `战术系统 ${id} 数据无效`) : defaultSystemSpec(id),
    isNew: !system,
  };
}

export async function saveEditorSpecByKind(modRoot: string, kind: EditorSpecKind, id: string, data: RowData): Promise<WriteResult> {
  const extension = editorSpecExtension(kind);
  ensureSpecContext(modRoot, id, extension);
  data[EDITOR_SPEC_ID_FIELDS[kind]] = data[EDITOR_SPEC_ID_FIELDS[kind]] || id;
  try {
    return await writeEditorSpec(modRoot, kind, id, data);
  } catch (error) {
    throw withCause(`保存 ${id}.${extension} 失败`, error, `save-${kind}-spec`);
  }
}

const EDITOR_SPEC_ID_FIELDS: Record<EditorSpecKind, string> = {
  ship: 'hullId',
  weapon: 'id',
  projectile: 'id',
  system: 'id',
};

export async function loadImportedSpecFile(path: string): Promise<RowData> {
  return loadJsonSpecFile(path);
}

export function uploadEditorSprite(modRoot: string, filename: string, data: string, subfolder: SpriteSubfolder, overwrite: boolean) {
  return writeSpriteUpload(modRoot, filename, data, subfolder, overwrite).then(
    (write): SpriteUploadResult => ({
      state: spriteUploadStateFromEntity(write.refreshedEntity),
      write,
    }),
  );
}

async function queryWeaponSprites(sessionId: ProjectSessionId, refs: Record<string, ResourceRef>): Promise<Record<string, string>> {
  const resources: { field: string; resource: ResourceRef }[] = [];
  for (const field of WEAPON_SPRITE_FIELDS) {
    const resource = refs[field];
    if (resource) resources.push({ field, resource });
  }
  if (resources.length === 0) return {};
  const dataUrls = await queryResourceDataUrls(
    sessionId,
    resources.map((entry) => entry.resource),
  );
  return Object.fromEntries(dataUrls.flatMap((dataUrl, index) => (dataUrl ? [[resources[index].field, dataUrl] as const] : [])));
}

async function querySpriteData(sessionId: ProjectSessionId, resource: ResourceRef | null): Promise<string> {
  if (!resource) return '';
  return (await queryResourceDataUrls(sessionId, [resource]))[0] ?? '';
}

async function queryProjectileOptions(sessionId: ProjectSessionId): Promise<EditorSelectOption[]> {
  const projectiles = await querySessionEntityList(sessionId, 'projectile');
  return projectiles.map((projectile) => ({ label: projectile.id, value: projectile.id }));
}

function requireEditorEntity(entity: EntityData | null, kind: EditorSpecKind, id: string): EntityData {
  if (entity) return entity;
  throw new AppError(`找不到 ${id} 的 ${kind} 数据。`, { action: 'query-editor-entity' });
}

function requireEditorRowData(value: unknown, message: string): RowData {
  return requireRowData(value, message);
}

function spriteUploadStateFromEntity(value: unknown): SpriteUploadState {
  const row = requireEditorRowData(value, '贴图上传返回状态无效');
  return {
    ok: row.ok === true,
    exists: row.exists === true,
    path: typeof row.path === 'string' ? row.path : '',
    overwritten: row.overwritten === true,
    message: typeof row.message === 'string' ? row.message : null,
  };
}

function ensureSpecContext(modRoot: string, id: string, extension: string) {
  if (!modRoot) {
    throw new AppError(`缺少 .${extension} 保存的 mod 根目录`, { action: 'save-spec' });
  }
  if (!id) {
    throw new AppError(`缺少 .${extension} 保存 id`, { action: 'save-spec' });
  }
}

function defaultShipSpec(id: string): RowData {
  return defaultShip(id);
}

function defaultProjectileSpec(id: string): RowData {
  return { id, specClass: 'projectile' };
}

function defaultSystemSpec(id: string): RowData {
  return { id, type: 'STAT_MOD' };
}
