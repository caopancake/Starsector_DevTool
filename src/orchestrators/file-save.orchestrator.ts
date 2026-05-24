import type { FileChangeRecord, WriteResult } from '@/services/write.service';
import { normalizeFsPath, pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '@/windows/window.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { invalidateProject } from '@/services/session.service';
import { invalidateQueryCacheByPaths } from '@/services/query-cache.service';
import { invalidateResourceCacheByPaths } from '@/services/resource-cache.service';

export function recordFileSave(modRoot: string, changes: FileChangeRecord[], label: string) {
  if (!modRoot || changes.length === 0) return false;
  const fileHistory = useFileHistoryStore();
  fileHistory.pushFileSaveEntry(modRoot, changes, label);
  return true;
}

export function recordSpriteUploadSaved(modRoot: string, changes: FileChangeRecord[], overwritten: boolean, filename: string) {
  const action = overwritten ? '覆盖贴图' : '上传贴图';
  return recordFileSave(modRoot, changes, `${action}: ${filename}`);
}

export function recordEditorSpecSaved(payload: EditorSpecSavedEvent) {
  if (payload.changes?.length) {
    recordFileSave(payload.modRoot, payload.changes, `保存 ${payload.id}.${editorExtension(payload.kind)}`);
    void invalidateChangedPaths(payload.modRoot, payload.changes);
  }
  return true;
}

export function recordFileEditorSaved(payload: FileEditorSavedEvent) {
  if (!payload.changes.length) return false;
  const project = useProjectStore();
  const modRoot = resolveLoadedModRootForPath([...project.manifests.keys()], payload.path);
  if (!modRoot) return false;
  recordFileSave(modRoot, payload.changes, `保存 ${pathBasename(payload.path)}`);
  void invalidateChangedPaths(modRoot, payload.changes);
  return true;
}

function editorExtension(kind: EditorSpecSavedEvent['kind']) {
  if (kind === 'ship') return 'ship';
  if (kind === 'weapon') return 'wpn';
  return 'proj';
}

function resolveLoadedModRootForPath(modRoots: string[], path: string): string | null {
  const normalizedPath = normalizeFsPath(path);
  const matches = modRoots.filter((modRoot) => {
    const normalizedRoot = normalizeFsPath(modRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  });
  matches.sort((a, b) => normalizeFsPath(b).length - normalizeFsPath(a).length);
  return matches[0] ?? null;
}

export async function invalidateChangedPathsForMod(modRoot: string, changes: FileChangeRecord[]) {
  await invalidateWriteResultForMod(modRoot, {
    changes,
    invalidatedPaths: changes.map((change) => change.path),
  });
}

export async function invalidateWriteResultForMod(modRoot: string, result: Pick<WriteResult, 'invalidatedPaths' | 'changes'>) {
  const project = useProjectStore();
  const sessionId = project.getSessionId(modRoot);
  if (!sessionId) return;
  const paths = result.invalidatedPaths;
  invalidateQueryCacheByPaths(sessionId);
  invalidateResourceCacheByPaths(sessionId, paths);
  await invalidateProject(sessionId, paths);
}

async function invalidateChangedPaths(modRoot: string, changes: FileChangeRecord[]) {
  await invalidateChangedPathsForMod(modRoot, changes);
}
