import type { FileChangeRecord } from '../../shared/api/files-api';
import { pathBasename } from '../../shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '../windowing/window-events';
import { useFileHistoryStore } from './file-history-store';
import { parseJsonSpecFileChange, resolveLoadedModRootForPath, syncEditorSpecChange } from './file-history-sync';
import { useProjectStore } from '../project/project-store';

export function recordFileSave(modRoot: string, changes: FileChangeRecord[], label: string) {
  if (!modRoot || changes.length === 0) return false;
  const fileHistory = useFileHistoryStore();
  fileHistory.pushFileSaveEntry(modRoot, changes, label);
  return true;
}

export function recordFileBarrier(modRoot: string, reason: 'sprite-overwrite', label: string) {
  if (!modRoot) return false;
  const fileHistory = useFileHistoryStore();
  fileHistory.pushFileHistoryBarrier(modRoot, reason, label);
  return true;
}

export function recordEditorSpecSaved(payload: EditorSpecSavedEvent) {
  const project = useProjectStore();
  if (!syncEditorSpecChange(project, payload)) return false;
  if (payload.changes?.length) {
    recordFileSave(payload.modRoot, payload.changes, `保存 ${payload.id}.${editorExtension(payload.kind)}`);
  }
  return true;
}

export function recordFileEditorSaved(payload: FileEditorSavedEvent) {
  if (!payload.changes.length) return false;
  const project = useProjectStore();
  const modRoot = resolveLoadedModRootForPath(project.modsData, payload.path);
  if (!modRoot) return false;
  recordFileSave(modRoot, payload.changes, `保存 ${pathBasename(payload.path)}`);
  for (const change of payload.changes) {
    const specChange = parseJsonSpecFileChange(project.modsData, change.path, change.afterText ?? null);
    if (specChange) syncEditorSpecChange(project, specChange);
  }
  return true;
}

function editorExtension(kind: EditorSpecSavedEvent['kind']) {
  if (kind === 'ship') return 'ship';
  if (kind === 'weapon') return 'wpn';
  return 'proj';
}
