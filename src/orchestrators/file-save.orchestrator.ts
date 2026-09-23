import { pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '@/windows/window.events';
import { useProjectStore } from '@/stores/project.store';
import { completeSavedWrite } from '@/orchestrators/file-history-write.orchestrator';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { logFields } from '@/shared/lib/log-fields';

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
  recordLogBestEffort({
    level: 'info',
    code: 'editor.file_saved',
    message: 'file editor saved',
    path: event.path,
    line: null,
    fields: logFields({ modRoot: event.modRoot, sessionId: event.sessionId, changes: event.writeResult.changes.length }),
  });
  return true;
}
