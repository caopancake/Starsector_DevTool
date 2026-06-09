import { pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent, SpriteUploadSavedEvent } from '@/windows/window.events';
import { useProjectStore } from '@/stores/project.store';
import { completeSavedWrite } from '@/orchestrators/file-history-session.orchestrator';
import type { WriteResult } from '@/shared/types';

async function completeSpriteUploadSaved(modRoot: string, result: WriteResult, overwritten: boolean, filename: string, sessionId: string) {
  const action = overwritten ? '覆盖贴图' : '上传贴图';
  await completeSavedWrite({ modRoot, result, label: `${action}: ${filename}`, sessionId }, useProjectStore());
}

export async function handleEditorSpecSaved(event: EditorSpecSavedEvent) {
  if (event.writeResult.changes.length) {
    await completeSavedWrite(
      { modRoot: event.modRoot, result: event.writeResult, label: `保存 ${event.id} spec`, sessionId: event.sessionId },
      useProjectStore(),
    );
    return true;
  }
  return false;
}

export async function handleFileEditorSaved(event: FileEditorSavedEvent) {
  if (!event.writeResult.changes.length) return false;
  await completeSavedWrite(
    { modRoot: event.modRoot, result: event.writeResult, label: `保存 ${pathBasename(event.path)}`, sessionId: event.sessionId },
    useProjectStore(),
  );
  return true;
}

export async function handleSpriteUploadSaved(event: SpriteUploadSavedEvent) {
  if (!event.writeResult.changes.length) return false;
  await completeSpriteUploadSaved(event.modRoot, event.writeResult, event.overwritten, event.filename, event.sessionId);
  return true;
}
