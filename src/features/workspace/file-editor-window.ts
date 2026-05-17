import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface FileEditorRequest {
  path: string;
  title?: string;
  contextLabel?: string;
  message?: string;
  line?: number;
}

function windowLabel(path: string): string {
  const normalizedPath = normalizeFileEditorPath(path);
  let hash = 0;
  for (let index = 0; index < normalizedPath.length; index += 1) {
    hash = (hash * 31 + normalizedPath.charCodeAt(index)) >>> 0;
  }
  return `file-editor-${hash.toString(16)}`;
}

function normalizeFileEditorPath(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+/g, '\\').toLocaleLowerCase();
}

export async function openFileEditorWindow(request: FileEditorRequest): Promise<void> {
  const label = windowLabel(request.path);
  const existing = await WebviewWindow.getByLabel(label);
  const query = new URLSearchParams({
    file: request.path,
  });
  if (request.title) query.set('title', request.title);
  if (request.contextLabel) query.set('contextLabel', request.contextLabel);
  if (request.message) query.set('message', request.message);
  if (request.line) query.set('line', String(request.line));

  if (existing) {
    await existing.setFocus();
    await existing.emit('file-editor-focus-line', {
      line: request.line ?? null,
      message: request.message ?? null,
      contextLabel: request.contextLabel ?? null,
    });
    return;
  }

  query.set('window', 'file-editor');

  new WebviewWindow(label, {
    url: `/?${query.toString()}`,
    title: request.title ?? '文件编辑器',
    width: 1040,
    height: 760,
    minWidth: 780,
    minHeight: 520,
  });
}
