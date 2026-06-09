import { EDITOR_WINDOW_KINDS, type EditorSpecKind, type EditorWindowKind, type RowData } from '@/shared/types';
import { defaultShip, defaultWeapon } from '@/shared/lib/starsector';

export interface EditorWindowSize {
  height: number;
  minHeight: number;
  minWidth: number;
  width: number;
}

export interface EditorWindowDefinition {
  label: string;
  size: EditorWindowSize;
  specKind: EditorSpecKind | null;
}

const EDITOR_DEFAULT_DATA_LOADERS: Record<EditorSpecKind, (id: string, row?: RowData) => RowData> = {
  ship: (id) => defaultShip(id),
  weapon: (id, row) => defaultWeapon(id, row ?? {}),
  projectile: (id) => ({ id, specClass: 'projectile' }),
  system: (id) => ({ id, type: 'STAT_MOD' }),
};

const EDITOR_WINDOW_DEFINITIONS: Record<EditorWindowKind, EditorWindowDefinition> = {
  ship: {
    label: '舰船编辑器',
    specKind: 'ship',
    size: { width: 1160, height: 760, minWidth: 860, minHeight: 560 },
  },
  weapon: {
    label: '武器编辑器',
    specKind: 'weapon',
    size: { width: 1160, height: 760, minWidth: 860, minHeight: 560 },
  },
  projectile: {
    label: '弹体编辑器',
    specKind: 'projectile',
    size: { width: 900, height: 760, minWidth: 720, minHeight: 520 },
  },
  system: {
    label: '战术系统编辑器',
    specKind: 'system',
    size: { width: 900, height: 760, minWidth: 720, minHeight: 520 },
  },
  'weapon-preview': {
    label: '发射预览',
    specKind: null,
    size: { width: 1120, height: 760, minWidth: 760, minHeight: 520 },
  },
};

export function isEditorWindowKind(value: string | null): value is EditorWindowKind {
  return Boolean(value && (EDITOR_WINDOW_KINDS as readonly string[]).includes(value));
}

export function editorWindowDefinition(kind: EditorWindowKind): EditorWindowDefinition {
  return EDITOR_WINDOW_DEFINITIONS[kind];
}

export function editorWindowTitle(kind: EditorWindowKind, id: string): string {
  return `${editorWindowDefinition(kind).label} - ${id}`;
}

export function editorWindowLabel(kind: EditorWindowKind): string {
  return editorWindowDefinition(kind).label;
}

export function defaultEditorSpec(kind: EditorSpecKind, id: string, row?: RowData): RowData {
  return EDITOR_DEFAULT_DATA_LOADERS[kind](id, row);
}

export function editorMissingTargetText(kind: EditorWindowKind, id: string): string {
  const specKind = editorWindowDefinition(kind).specKind;
  if (!specKind) return `找不到 ${id} 的预览数据。`;
  return `找不到 ${id} 的 spec。`;
}
