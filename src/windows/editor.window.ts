import { openManagedWindow } from '@/windows/managed.window';
import type { AppSettings, EditorWindowKind, ProjectSessionId, RowData } from '@/shared/types';
import { editorWindowDefinition, editorWindowTitle } from '@/domain/editors/editor-definitions';
export type { EditorSpecSavedEvent } from '@/windows/window.events';

export interface EditorWindowRequest {
  kind: EditorWindowKind;
  sessionId: ProjectSessionId;
  modRoot: string;
  id: string;
  settings: AppSettings;
  starsectorRoot?: string | null;
  title?: string;
  draftSnapshot?: RowData;
}

export async function openEditorWindow(request: EditorWindowRequest): Promise<void> {
  const definition = editorWindowDefinition(request.kind);
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
      draftSnapshot: request.draftSnapshot ? JSON.stringify(request.draftSnapshot) : undefined,
    },
    size: definition.size,
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
