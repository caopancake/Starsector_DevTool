import type { RowData } from '../../shared/types';
import type { EditorWindowKind } from '../editors/editor-window';

export const WINDOW_EVENTS = {
  editorSpecSaved: 'editor-spec-saved',
  fileEditorFocusLine: 'file-editor-focus-line',
} as const;

export interface EditorSpecSavedEvent {
  kind: Exclude<EditorWindowKind, 'weapon-preview'>;
  modRoot: string;
  id: string;
  spec: RowData;
}

export interface FileEditorFocusLineEvent {
  contextLabel?: string | null;
  line?: number | null;
  message?: string | null;
}
