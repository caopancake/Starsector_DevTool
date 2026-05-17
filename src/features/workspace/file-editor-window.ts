import { openManagedWindow } from '../windowing/managed-window';
import { WINDOW_EVENTS, type FileEditorFocusLineEvent } from '../windowing/window-events';

export interface FileEditorRequest {
  path: string;
  title?: string;
  contextLabel?: string;
  message?: string;
  line?: number;
}

export function openFileEditorWindow(request: FileEditorRequest): Promise<void> {
  return openManagedWindow({
    labelPrefix: 'file-editor',
    singletonKey: request.path,
    title: request.title ?? '文件编辑器',
    urlParams: {
      window: 'file-editor',
      file: request.path,
      title: request.title,
      contextLabel: request.contextLabel,
      message: request.message,
      line: request.line,
    },
    size: {
      width: 1040,
      height: 760,
      minWidth: 780,
      minHeight: 520,
    },
    focusEvent: {
      name: WINDOW_EVENTS.fileEditorFocusLine,
      payload: {
        line: request.line ?? null,
        message: request.message ?? null,
        contextLabel: request.contextLabel ?? null,
      } satisfies FileEditorFocusLineEvent,
    },
  });
}
