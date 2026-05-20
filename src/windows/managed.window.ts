import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface ManagedWindowSize {
  height: number;
  minHeight: number;
  minWidth: number;
  width: number;
}

export interface ManagedWindowRequest {
  focusEvent?: {
    name: string;
    payload: unknown;
  };
  labelPrefix: string;
  singletonKey: string;
  title: string;
  urlParams: Record<string, string | number | null | undefined>;
  size: ManagedWindowSize;
}

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
    if (request.focusEvent) await existing.emit(request.focusEvent.name, request.focusEvent.payload);
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.urlParams)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
  }

  new WebviewWindow(label, {
    url: `/?${query.toString()}`,
    title: request.title,
    visible: false,
    ...request.size,
  });
}
