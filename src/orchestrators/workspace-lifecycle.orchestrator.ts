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

// 关闭 Mod 的 5-store 清理序列唯一用例：workspace/tables/fileHistory/csvEditHistory/project。
// 缓存失效、Rust session 关闭与视图回退等差异行为由各调用方在用例之外自行组合。
export function removeModRuntimeState(modRoot: string) {
  const workspace = useWorkspaceStore();
  const project = useProjectStore();
  const tables = useTablesStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  workspace.removeLoadedModEntry(modRoot);
  tables.removeModState(modRoot);
  fileHistory.removeModState(modRoot);
  csvEditHistory.clearForMod(modRoot);
  project.removeProjectManifest(modRoot);
}

export async function removeLoadedModRuntime(modRoot: string) {
  const project = useProjectStore();
  const sessionId = project.getSessionId(modRoot);

  if (sessionId) {
    invalidateQueryCacheForSession(sessionId);
    invalidateResourceCacheForSession(sessionId);
  }

  removeModRuntimeState(modRoot);

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
  workspace.clearModOpeningFailures();
  if (!workspace.activeModRoot) workspace.showOverview();
}
