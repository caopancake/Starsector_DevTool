import type { WriteResult } from '@/shared/types';
import { pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent, SpriteUploadSavedEvent } from '@/windows/window.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { editorSpecExtension } from '@/domain/editors/editor-kind-metadata';
import { invalidateProjectSessionForWriteResult } from '@/orchestrators/project-session-invalidation.orchestrator';

export function recordFileSave(modRoot: string, result: WriteResult, label: string, expectedSessionId?: string | null) {
  if (!modRoot || result.changes.length === 0) return false;
  if (expectedSessionId) {
    const project = useProjectStore();
    const manifest = project.getManifest(modRoot);
    if (!manifest || manifest.sessionId !== expectedSessionId) return false;
  }
  const fileHistory = useFileHistoryStore();
  fileHistory.pushFileSaveEntry(modRoot, result.changes, label);
  return true;
}

export function recordSpriteUploadSaved(
  modRoot: string,
  result: WriteResult,
  overwritten: boolean,
  filename: string,
  expectedSessionId?: string | null,
) {
  const action = overwritten ? '覆盖贴图' : '上传贴图';
  return recordFileSave(modRoot, result, `${action}: ${filename}`, expectedSessionId);
}

export async function handleEditorSpecSaved(event: EditorSpecSavedEvent) {
  const project = useProjectStore();
  const manifest = project.getManifest(event.modRoot);
  if (!manifest || manifest.sessionId !== event.sessionId) return false;
  if (event.writeResult.changes.length) {
    recordFileSave(event.modRoot, event.writeResult, `保存 ${event.id}.${editorSpecExtension(event.kind)}`, event.sessionId);
    await refreshProjectSessionAfterWrite(event.modRoot, event.writeResult, event.sessionId);
  }
  return true;
}

export async function handleFileEditorSaved(event: FileEditorSavedEvent) {
  if (!event.writeResult.changes.length) return false;
  const project = useProjectStore();
  const manifest = project.getManifest(event.modRoot);
  if (!manifest || manifest.sessionId !== event.sessionId) return false;
  recordFileSave(event.modRoot, event.writeResult, `保存 ${pathBasename(event.path)}`, event.sessionId);
  await refreshProjectSessionAfterWrite(event.modRoot, event.writeResult, event.sessionId);
  return true;
}

export async function handleSpriteUploadSaved(event: SpriteUploadSavedEvent) {
  if (!event.writeResult.changes.length) return false;
  const project = useProjectStore();
  const manifest = project.getManifest(event.modRoot);
  if (!manifest || manifest.sessionId !== event.sessionId) return false;
  recordSpriteUploadSaved(event.modRoot, event.writeResult, event.overwritten, event.filename, event.sessionId);
  await refreshProjectSessionAfterWrite(event.modRoot, event.writeResult, event.sessionId);
  return true;
}

export async function refreshProjectSessionAfterWrite(modRoot: string, result: WriteResult, expectedSessionId?: string | null) {
  await invalidateProjectSessionForWriteResult(modRoot, result, expectedSessionId);
}
