import { classifyFrontendPath } from './classify.mjs';

export function frontendLayer(rel) {
  return classifyFrontendPath(rel).layer;
}

export function isSharedApiBoundary(rel) {
  const layer = frontendLayer(rel);
  return rel.startsWith('src/shared/api/') || layer === 'services' || layer === 'orchestrators';
}

export function isTauriRuntimeBoundary(rel, specifier) {
  if (rel.startsWith('src/shared/api/')) return specifier === '@tauri-apps/api/core' || specifier === '@tauri-apps/api/event';
  if (rel.startsWith('src/shared/runtime/')) return specifier === '@tauri-apps/plugin-dialog';
  if (rel.startsWith('src/windows/')) return isWindowRuntimeBoundary(rel, specifier);
  return false;
}

export function isWindowRootComponent(file) {
  return file.rel.startsWith('src/app/') && file.rel.endsWith('.vue') && file.text.includes('<WindowShell>');
}

function isWindowRuntimeBoundary(rel, specifier) {
  if (rel.endsWith('.events.ts')) return specifier === '@tauri-apps/api/event';
  if (rel.endsWith('.window.ts')) return specifier === '@tauri-apps/api/window' || specifier === '@tauri-apps/api/webviewWindow';
  return false;
}
