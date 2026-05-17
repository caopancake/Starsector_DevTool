import type { FileChangeRecord } from '../../shared/api/files-api';
import { normalizeFsPath, pathBasename } from '../../shared/lib/paths';
import type { AppData } from '../../shared/types';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '../windowing/window-events';
import { useFileHistoryStore } from './file-history-store';
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
  return true;
}

function editorExtension(kind: EditorSpecSavedEvent['kind']) {
  if (kind === 'ship') return 'ship';
  if (kind === 'weapon') return 'wpn';
  return 'proj';
}

function syncEditorSpecChange(project: ReturnType<typeof useProjectStore>, specChange: EditorSpecSavedEvent) {
  if (!project.getModData(specChange.modRoot)) return false;
  if (specChange.kind === 'ship') {
    project.updateShipFile(specChange.modRoot, specChange.id, specChange.spec);
  } else if (specChange.kind === 'weapon') {
    project.updateWeaponFile(specChange.modRoot, specChange.id, specChange.spec);
  } else {
    project.updateProjectileFile(specChange.modRoot, specChange.id, specChange.spec);
  }
  return true;
}

function resolveLoadedModRootForPath(modsData: Map<string, AppData>, path: string): string | null {
  const normalizedPath = normalizeFsPath(path);
  const matches = [...modsData.keys()].filter((modRoot) => {
    const normalizedRoot = normalizeFsPath(modRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  });
  matches.sort((a, b) => normalizeFsPath(b).length - normalizeFsPath(a).length);
  return matches[0] ?? null;
}
