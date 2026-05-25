export const EDITOR_KINDS = ['ship', 'weapon', 'projectile'] as const;
export const EDITOR_WINDOW_KINDS = ['ship', 'weapon', 'projectile', 'weapon-preview'] as const;

export type EditorKind = (typeof EDITOR_KINDS)[number];
export type EditorWindowKind = (typeof EDITOR_WINDOW_KINDS)[number];

export type EditorSpecKind = EditorKind;

export interface EditableFileData {
  path: string;
  text: string;
}
