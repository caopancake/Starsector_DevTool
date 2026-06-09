import { openManagedWindow } from '@/windows/managed.window';
import { WINDOW_EVENTS, type FileEditorFocusLineEvent } from '@/windows/window.events';
import type { AppSettings } from '@/shared/types';

export interface FileEditorRequest {
  modRoot: string | null;
  path: string;
  sessionId: string | null;
  title?: string;
  contextLabel?: string;
  contextSeverity?: FileEditorFocusLineEvent['contextSeverity'];
  message?: string;
  line?: number;
}

export type OpenFileEditorWindowRequest = FileEditorRequest & {
  settings: AppSettings;
};

export function openFileEditorWindow(request: OpenFileEditorWindowRequest): Promise<void> {
  return openManagedWindow({
    labelPrefix: 'file-editor',
    singletonKey: JSON.stringify([request.sessionId, request.modRoot, request.path]),
    title: request.title ?? '文件编辑器',
    urlParams: {
      window: 'file-editor',
      modRoot: request.modRoot,
      sessionId: request.sessionId,
      file: request.path,
      title: request.title,
      contextLabel: request.contextLabel,
      contextSeverity: request.contextSeverity,
      message: request.message,
      line: request.line,
      settings: JSON.stringify(request.settings),
    },
    size: {
      width: 1040,
      height: 760,
      minWidth: 780,
      minHeight: 520,
    },
    focusEvent: {
      name: WINDOW_EVENTS.fileEditorFocusLine,
      data: {
        line: request.line ?? null,
        message: request.message ?? null,
        contextLabel: request.contextLabel ?? null,
        contextSeverity: request.contextSeverity ?? null,
      } satisfies FileEditorFocusLineEvent,
    },
  });
}
