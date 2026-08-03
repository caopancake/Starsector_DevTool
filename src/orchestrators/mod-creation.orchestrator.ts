import { openCreatedModTarget, type DirectoryOpeningOutcome } from '@/orchestrators/directory-opening.orchestrator';
import { createNewModProject } from '@/services/mod-creation.service';
import { measurePerformanceAsync } from '@/services/performance.service';
import type { CreatedMod, CreateModRequest } from '@/shared/types';

export interface CreatedModProject {
  modName: string;
  warnings: string[];
}

export function createModProject(request: CreateModRequest): Promise<CreatedMod> {
  return measurePerformanceAsync('frontend.createModProject', { destination: request.destination.kind, modId: request.template.id }, () =>
    createNewModProject(request),
  );
}

export async function openCreatedModProject(created: CreatedMod): Promise<CreatedModProject> {
  const outcome = await measurePerformanceAsync(
    'frontend.openCreatedModProject',
    { modRoot: created.modRoot, hasStarsectorRoot: Boolean(created.starsectorRoot) },
    () => openCreatedModTarget(created),
  );
  return openedCreatedMod(outcome);
}

function openedCreatedMod(outcome: DirectoryOpeningOutcome): CreatedModProject {
  if (outcome.type === 'mod-loaded') {
    return { modName: outcome.modName, warnings: outcome.warnings };
  }
  if (outcome.type === 'already-loaded') {
    throw new Error(`新建 Mod 已意外存在于工作区：${outcome.modName}`);
  }
  if (outcome.type === 'unknown') {
    throw new Error(`Mod 已创建，但无法打开：${outcome.message}`);
  }
  throw new Error('Mod 已创建，但创建结果打开返回了无效状态');
}
