import { openManagedWindow, type ManagedWindowSize } from '@/windows/managed.window';
import type { AppSettings, EditorWindowKind, ProjectSessionId } from '@/shared/types';
import { editorWindowTitle } from '@/domain/editors/editor-kind-metadata';
export type { EditorSpecSavedEvent } from '@/windows/window.events';

export interface EditorWindowRequest {
  kind: EditorWindowKind;
  sessionId: ProjectSessionId;
  modRoot: string;
  id: string;
  settings: AppSettings;
  starsectorRoot?: string | null;
  title?: string;
}

const EDITOR_WINDOW_SIZES: Record<EditorWindowKind, ManagedWindowSize> = {
  ship: { width: 1160, height: 760, minWidth: 860, minHeight: 560 },
  weapon: { width: 1160, height: 760, minWidth: 860, minHeight: 560 },
  projectile: { width: 900, height: 760, minWidth: 720, minHeight: 520 },
  system: { width: 900, height: 760, minWidth: 720, minHeight: 520 },
  'weapon-preview': { width: 1120, height: 760, minWidth: 760, minHeight: 520 },
};

export async function openEditorWindow(request: EditorWindowRequest): Promise<void> {
  await openManagedWindow({
    labelPrefix: `editor-${request.kind}`,
    singletonKey: JSON.stringify([request.kind, request.modRoot, request.id]),
    title: request.title ?? editorWindowTitle(request.kind, request.id),
    urlParams: {
      window: 'editor',
      kind: request.kind,
      sessionId: request.sessionId,
      modRoot: request.modRoot,
      id: request.id,
      settings: JSON.stringify(request.settings),
      starsectorRoot: request.starsectorRoot,
    },
    size: EDITOR_WINDOW_SIZES[request.kind],
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

export function openSystemEditorWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'system' });
}

export function openWeaponPreviewWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'weapon-preview' });
}
