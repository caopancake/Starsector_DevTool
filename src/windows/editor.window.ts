import { openManagedWindow } from '@/windows/managed.window';
import type { AppSettings, EditorWindowKind, ProjectSessionId, RowData } from '@/shared/types';
import { editorWindowDefinition, editorWindowTitle } from '@/domain/editors/editor-definitions';

// draftSnapshot 走 URL query 的独立上限：超限去掉该参数优雅降级，
// 预览窗口回退到已保存 bundle，不阻断开窗。
const DRAFT_SNAPSHOT_QUERY_LIMIT = 8000;

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
      draftSnapshot: draftSnapshotParam(request.draftSnapshot),
    },
    size: definition.size,
  });
}

function draftSnapshotParam(draftSnapshot: RowData | undefined): string | undefined {
  if (!draftSnapshot) return undefined;
  const serialized = JSON.stringify(draftSnapshot);
  return serialized.length <= DRAFT_SNAPSHOT_QUERY_LIMIT ? serialized : undefined;
}

export function openProjectileEditorWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'projectile' });
}

export function openWeaponPreviewWindow(request: Omit<EditorWindowRequest, 'kind'>): Promise<void> {
  return openEditorWindow({ ...request, kind: 'weapon-preview' });
}
