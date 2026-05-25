import type { RowData } from '@/shared/types';
import type { WriteResult } from '@/shared/types';
import type { AppSettings } from '@/shared/types';
import type { EditorSpecKind } from '@/shared/types';

export const WINDOW_EVENTS = {
  editorSpecSaved: 'editor-spec-saved',
  fileEditorFocusLine: 'file-editor-focus-line',
  fileEditorSaved: 'file-editor-saved',
  fileEditorTextApplied: 'file-editor-text-applied',
  appSettingsChanged: 'app-settings-changed',
} as const;

export interface EditorSpecSavedEvent {
  kind: EditorSpecKind;
  modRoot: string;
  id: string;
  spec: RowData;
  writeResult: WriteResult;
}

export type FileEditorContextSeverity = 'error' | 'info';

export interface FileEditorFocusLineEvent {
  contextLabel: string | null;
  contextSeverity: FileEditorContextSeverity | null;
  line: number | null;
  message: string | null;
}

export interface FileEditorSavedEvent {
  path: string;
  writeResult: WriteResult;
}

export interface FileEditorTextAppliedEvent {
  path: string;
  text: string;
}

export type AppSettingsChangedEvent = AppSettings;
