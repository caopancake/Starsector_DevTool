import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface ManagedWindowSize {
  height: number;
  minHeight: number;
  minWidth: number;
  width: number;
}

export interface ManagedWindowRequest {
  focusEvent?: {
    data: unknown;
    name: string;
  };
  labelPrefix: string;
  singletonKey: string;
  title: string;
  urlParams: Record<string, string | number | null | undefined>;
  size: ManagedWindowSize;
}

// Total-length guard for the URL query carrying settings/draftSnapshot and similar large
// fields: refuse creation above the limit with an explicit error.
export const MANAGED_WINDOW_QUERY_MAX_LENGTH = 12000;

export function normalizeWindowKey(value: string): string {
  return value.replace(/\//g, '\\').replace(/\\+/g, '\\').toLocaleLowerCase();
}

export function hashWindowKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

export async function openManagedWindow(request: ManagedWindowRequest): Promise<void> {
  const label = `${request.labelPrefix}-${hashWindowKey(normalizeWindowKey(request.singletonKey))}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    if (request.focusEvent) await existing.emit(request.focusEvent.name, request.focusEvent.data);
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.urlParams)) {
    if (value !== null && value !== undefined) query.set(key, String(value));
  }
  const queryString = query.toString();
  if (queryString.length > MANAGED_WINDOW_QUERY_MAX_LENGTH) {
    throw new Error(`窗口「${request.title}」参数超出长度限制（${queryString.length} > ${MANAGED_WINDOW_QUERY_MAX_LENGTH}），已取消打开`);
  }

  await new Promise<void>((resolve, reject) => {
    const webview = new WebviewWindow(label, {
      url: `/?${queryString}`,
      title: request.title,
      visible: false,
      ...request.size,
    });
    webview.once('tauri://created', () => resolve());
    webview.once('tauri://error', (event) => {
      const payload = (event as { payload?: unknown }).payload;
      const detail = typeof payload === 'string' && payload ? payload : '未知错误';
      reject(new Error(`窗口「${request.title}」创建失败：${detail}`));
    });
  });
}
