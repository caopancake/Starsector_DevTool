import { EDITOR_WINDOW_KINDS, type EditorSpecKind, type EditorWindowKind } from '@/shared/types';

const EDITOR_WINDOW_LABELS: Record<EditorWindowKind, string> = {
  ship: '舰船编辑器',
  weapon: '武器编辑器',
  projectile: '弹体编辑器',
  system: '战术系统编辑器',
  'weapon-preview': '发射预览',
};

const EDITOR_SPEC_EXTENSIONS: Record<EditorSpecKind, string> = {
  ship: 'ship',
  weapon: 'wpn',
  projectile: 'proj',
  system: 'system',
};

export function isEditorWindowKind(value: string | null): value is EditorWindowKind {
  return Boolean(value && (EDITOR_WINDOW_KINDS as readonly string[]).includes(value));
}

export function editorWindowTitle(kind: EditorWindowKind, id: string): string {
  return `${EDITOR_WINDOW_LABELS[kind]} - ${id}`;
}

export function editorWindowLabel(kind: EditorWindowKind): string {
  return EDITOR_WINDOW_LABELS[kind];
}

export function editorSpecExtension(kind: EditorSpecKind): string {
  return EDITOR_SPEC_EXTENSIONS[kind];
}

export function editorMissingTargetText(kind: EditorWindowKind, id: string): string {
  if (kind === 'weapon-preview') return `找不到 ${id} 的预览数据。`;
  return `找不到 ${id}.${editorSpecExtension(kind)}。`;
}
