import { openManagedWindow, type ManagedWindowSize } from '@/windows/managed.window';
import type { AppSettings } from '@/shared/types';
export type { EditorSpecSavedEvent } from '@/windows/window.events';

export type EditorWindowKind = 'ship' | 'weapon' | 'projectile' | 'weapon-preview';

export interface EditorWindowRequest {
  kind: EditorWindowKind;
  modRoot: string;
  id: string;
  settings: AppSettings;
  starsectorRoot?: string | null;
  title?: string;
}

function defaultTitle(request: EditorWindowRequest): string {
  if (request.kind === 'ship') return `舰船编辑器 - ${request.id}`;
  if (request.kind === 'weapon') return `武器编辑器 - ${request.id}`;
  if (request.kind === 'projectile') return `弹体编辑器 - ${request.id}`;
  return `发射预览 - ${request.id}`;
}

function windowSize(kind: EditorWindowKind): ManagedWindowSize {
  if (kind === 'projectile') return { width: 900, height: 760, minWidth: 720, minHeight: 520 };
  if (kind === 'weapon-preview') return { width: 1120, height: 760, minWidth: 760, minHeight: 520 };
  return { width: 1160, height: 760, minWidth: 860, minHeight: 560 };
}

export async function openEditorWindow(request: EditorWindowRequest): Promise<void> {
  await openManagedWindow({
    labelPrefix: `editor-${request.kind}`,
    singletonKey: `${request.kind}:${request.modRoot}:${request.id}`,
    title: request.title ?? defaultTitle(request),
    urlParams: {
      window: 'editor',
      kind: request.kind,
      modRoot: request.modRoot,
      id: request.id,
      settings: JSON.stringify(request.settings),
      starsectorRoot: request.starsectorRoot,
    },
    size: windowSize(request.kind),
  });
}

export function openShipEditorWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'ship' });
}

export function openWeaponEditorWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'weapon' });
}

export function openProjectileEditorWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'projectile' });
}

export function openWeaponPreviewWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'weapon-preview' });
}
