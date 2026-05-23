import { pickDirectoryDialog } from '@/shared/runtime/dialog.runtime';
import { loadMod, scanGameOverview } from '@/shared/api/project-api';
import type { AppData, GameOverviewData } from '@/shared/types';
import { recordPerformance } from '@/services/performance.service';

export async function pickDirectory(): Promise<string | null> {
  return pickDirectoryDialog('选择 Starsector 游戏目录或 Mod 目录');
}

export async function loadProject(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
  const fields = { modRoot, hasStarsectorRoot: Boolean(starsectorRoot) };
  const startedAt = performance.now();
  const invokeStartedAt = performance.now();
  const data = await loadMod(modRoot, starsectorRoot);
  recordPerformance('frontend.loadProject.invokeAndDeserialize', performance.now() - invokeStartedAt, fields);

  const probeStartedAt = performance.now();
  const json = JSON.stringify(data);
  recordPerformance('frontend.loadProject.appDataSizeProbe', performance.now() - probeStartedAt, {
    ...fields,
    bytes: new Blob([json]).size,
    tables: data.csvHeaders ? Object.keys(data.csvHeaders).length : 0,
    warnings: data.warnings?.length ?? 0,
  });
  recordPerformance('frontend.loadProject', performance.now() - startedAt, fields);
  return data;
}

export function scanWorkspaceOverview(starsectorRoot: string): Promise<GameOverviewData> {
  return scanGameOverview(starsectorRoot);
}
