import { useEditorsStore } from '@/stores/editors.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { closeProject, invalidateCoreCacheForRoot } from '@/services/session.service';
import { invalidateQueryCacheForSession } from '@/services/query-cache.service';
import { invalidateResourceCacheForSession } from '@/services/resource-cache.service';

export interface WorkspaceCloseTarget {
  gameOverviewRoot: string | null;
  modRoots: string[];
  starsectorRoots: string[];
}

export function captureWorkspaceCloseTarget(): WorkspaceCloseTarget {
  const workspace = useWorkspaceStore();
  const project = useProjectStore();
  const starsectorRoots = new Set(
    [workspace.gameOverview?.starsectorRoot, ...[...project.manifests.values()].map((manifest) => manifest.starsectorRoot)].filter(
      (root): root is string => Boolean(root),
    ),
  );
  return {
    gameOverviewRoot: workspace.gameOverview?.starsectorRoot ?? null,
    modRoots: workspace.loadedModList.map((mod) => mod.modRoot),
    starsectorRoots: [...starsectorRoots],
  };
}

export async function removeLoadedModRuntime(modRoot: string) {
  const workspace = useWorkspaceStore();
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const sessionId = project.getSessionId(modRoot);

  if (sessionId) {
    invalidateQueryCacheForSession(sessionId);
    invalidateResourceCacheForSession(sessionId);
  }

  workspace.removeLoadedModEntry(modRoot);
  tables.removeModState(modRoot);
  editors.removeModState(modRoot);
  fileHistory.removeModState(modRoot);
  csvEditHistory.clearForMod(modRoot);
  project.removeProjectManifest(modRoot);

  if (sessionId) await closeProject(sessionId);
}

export async function closeWorkspaceRuntime(target: WorkspaceCloseTarget) {
  const workspace = useWorkspaceStore();
  for (const modRoot of target.modRoots) {
    await removeLoadedModRuntime(modRoot);
  }
  await Promise.all(target.starsectorRoots.map((root) => invalidateCoreCacheForRoot(root)));
  if (workspace.gameOverview?.starsectorRoot === target.gameOverviewRoot) {
    workspace.setGameOverview(null);
  }
  if (!workspace.activeModRoot) workspace.showOverview();
}
