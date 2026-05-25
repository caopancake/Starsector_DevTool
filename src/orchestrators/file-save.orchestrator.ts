import type { WriteResult } from '@/shared/types';
import { closestRootForPath, pathBasename } from '@/shared/lib/paths';
import type { EditorSpecSavedEvent, FileEditorSavedEvent } from '@/windows/window.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { invalidateProject } from '@/services/session.service';
import { invalidateQueryCacheByPaths } from '@/services/query-cache.service';
import { invalidateResourceCacheByPaths } from '@/services/resource-cache.service';
import { editorSpecExtension } from '@/domain/editors/editor-kind-metadata';

export function recordFileSave(modRoot: string, result: WriteResult, label: string) {
  if (!modRoot || result.changes.length === 0) return false;
  const fileHistory = useFileHistoryStore();
  fileHistory.pushFileSaveEntry(modRoot, result.changes, label);
  return true;
}

export function recordSpriteUploadSaved(modRoot: string, result: WriteResult, overwritten: boolean, filename: string) {
  const action = overwritten ? '覆盖贴图' : '上传贴图';
  return recordFileSave(modRoot, result, `${action}: ${filename}`);
}

export async function handleEditorSpecSaved(event: EditorSpecSavedEvent) {
  if (event.writeResult.changes.length) {
    recordFileSave(event.modRoot, event.writeResult, `保存 ${event.id}.${editorSpecExtension(event.kind)}`);
    await invalidateWriteResultForMod(event.modRoot, event.writeResult);
  }
  return true;
}

export async function handleFileEditorSaved(event: FileEditorSavedEvent) {
  if (!event.writeResult.changes.length) return false;
  const project = useProjectStore();
  const modRoot = resolveLoadedModRootForPath([...project.manifests.keys()], event.path);
  if (!modRoot) return false;
  recordFileSave(modRoot, event.writeResult, `保存 ${pathBasename(event.path)}`);
  await invalidateWriteResultForMod(modRoot, event.writeResult);
  return true;
}

function resolveLoadedModRootForPath(modRoots: string[], path: string): string | null {
  return closestRootForPath(modRoots, path);
}

export async function invalidateWriteResultForMod(modRoot: string, result: WriteResult) {
  const project = useProjectStore();
  const manifest = project.getManifest(modRoot);
  if (!manifest) return;
  const paths = result.invalidatedPaths;
  const projectRoot = manifest.modRoot;
  invalidateQueryCacheByPaths(manifest, paths);
  invalidateResourceCacheByPaths(manifest.sessionId, projectRoot, paths);
  await invalidateProject(manifest.sessionId, paths);
}
