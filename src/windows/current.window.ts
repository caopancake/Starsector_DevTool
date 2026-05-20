import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export async function closeCurrentWindow(): Promise<void> {
  await appWindow.close();
}

export async function minimizeCurrentWindow(): Promise<void> {
  await appWindow.minimize();
}

export async function toggleMaximizeCurrentWindow(): Promise<void> {
  await appWindow.toggleMaximize();
}

export async function isCurrentWindowMaximized(): Promise<boolean> {
  return appWindow.isMaximized();
}

export async function startCurrentWindowDrag(): Promise<void> {
  await appWindow.startDragging();
}

export async function closeCurrentWebviewWindow(): Promise<void> {
  await getCurrentWebviewWindow().close();
}

export async function reloadCurrentWebviewWindow(): Promise<void> {
  window.location.reload();
}

export async function showCurrentWindow(): Promise<void> {
  await appWindow.show();
}
