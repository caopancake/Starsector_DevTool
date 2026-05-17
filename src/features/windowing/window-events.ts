import type { RowData } from '../../shared/types';
import type { FileChangeRecord } from '../../shared/api/tauri';
import type { EditorWindowKind } from '../editors/editor-window';

export const WINDOW_EVENTS = {
  editorSpecSaved: 'editor-spec-saved',
  editorSpecApplied: 'editor-spec-applied',
  fileEditorFocusLine: 'file-editor-focus-line',
  fileEditorSaved: 'file-editor-saved',
  fileEditorTextApplied: 'file-editor-text-applied',
} as const;

export interface EditorSpecSavedEvent {
  kind: Exclude<EditorWindowKind, 'weapon-preview'>;
  modRoot: string;
  id: string;
  spec: RowData;
  changes?: FileChangeRecord[];
}

export type EditorSpecAppliedEvent = EditorSpecSavedEvent;

export interface FileEditorFocusLineEvent {
  contextLabel?: string | null;
  line?: number | null;
  message?: string | null;
}

export interface FileEditorSavedEvent {
  path: string;
  changes: FileChangeRecord[];
}

export interface FileEditorTextAppliedEvent {
  path: string;
  text: string;
}
