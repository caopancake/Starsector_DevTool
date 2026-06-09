import { WINDOW_EVENTS, type ProjectSessionInvalidatedEvent } from '@/windows/window.events';
import { emitWindowEvent, listenWindowEvent, type WindowEventHandler } from '@/windows/tauri.events';
import { recordWindowEventHandlerError } from '@/orchestrators/window-event-errors.orchestrator';
import { useProjectStore } from '@/stores/project.store';
import { requestProjectSessionRefresh } from '@/services/session.service';
import { invalidateQueryCacheByProject } from '@/services/query-cache.service';
import { invalidateResourceCacheByProject } from '@/services/resource-cache.service';
import { isAbsoluteFsPath, pathBelongsToRoot, pathIsProjectScopedChangedPath } from '@/shared/lib/paths';
import { AppError } from '@/shared/lib/errors';
import type { ProjectManifest, WriteResult } from '@/shared/types';

function emitProjectSessionInvalidated(event: ProjectSessionInvalidatedEvent) {
  return emitWindowEvent(WINDOW_EVENTS.projectSessionInvalidated, event);
}

export function listenProjectSessionInvalidated(handler: WindowEventHandler<ProjectSessionInvalidatedEvent>) {
  return listenWindowEvent<ProjectSessionInvalidatedEvent>(WINDOW_EVENTS.projectSessionInvalidated, handler, recordWindowEventHandlerError);
}

export function applyProjectSessionCacheInvalid(event: ProjectSessionInvalidatedEvent) {
  invalidateResourceCacheByProject(event.manifest.sessionId, event.invalidation);
  invalidateQueryCacheByProject(event.manifest.sessionId, event.invalidation);
}

export async function refreshProjectSessionAfterWrite(modRoot: string, result: WriteResult, expectedSessionId?: string | null) {
  const project = useProjectStore();
  const manifest = project.getManifest(modRoot);
  if (!manifest) throw new AppError('无法刷新 ProjectSession：Mod 未加载', { action: 'refresh-project-session-after-write' });
  if (expectedSessionId && manifest.sessionId !== expectedSessionId) {
    throw new AppError('无法刷新 ProjectSession：ProjectSession 已变化', { action: 'refresh-project-session-after-write' });
  }
  const scopedPaths = result.invalidation.paths.filter((path) => pathIsProjectScopedChangedPath(path, manifest.modRoot));
  if (scopedPaths.length === 0) {
    throw new AppError('无法刷新 ProjectSession：写入结果没有命中当前 Mod 的失效路径', {
      action: 'refresh-project-session-after-write',
    });
  }
  return refreshProjectSessionByChangedPaths(project, manifest, scopedPaths);
}

export async function refreshLoadedSessionsAfterWrite(result: WriteResult, relativePathModRoot: string | null) {
  const project = useProjectStore();
  const events: ProjectSessionInvalidatedEvent[] = [];
  await Promise.all(
    [...project.manifests.values()].map(async (manifest) => {
      const scopedPaths = result.invalidation.paths.filter((path) =>
        isAbsoluteFsPath(path) ? pathBelongsToRoot(path, manifest.modRoot) : manifest.modRoot === relativePathModRoot,
      );
      if (scopedPaths.length === 0) return;
      const event = await refreshProjectSessionByChangedPaths(project, manifest, scopedPaths);
      events.push(event);
    }),
  );
  return events;
}

async function refreshProjectSessionByChangedPaths(
  project: ReturnType<typeof useProjectStore>,
  manifest: ProjectManifest,
  changedPaths: string[],
): Promise<ProjectSessionInvalidatedEvent> {
  const result = await requestProjectSessionRefresh(manifest.sessionId, changedPaths);
  project.replaceProjectManifest(result.manifest);
  const event = { manifest: result.manifest, invalidation: result.invalidation };
  applyProjectSessionCacheInvalid(event);
  await emitProjectSessionInvalidated(event);
  return event;
}
