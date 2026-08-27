import { pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '@/windows/window.events';
import { useProjectStore } from '@/stores/project.store';
import { completeSavedWrite } from '@/orchestrators/file-history-session.orchestrator';

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
