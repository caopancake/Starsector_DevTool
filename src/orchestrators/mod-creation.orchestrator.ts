import { openDirectoryTarget, type DirectoryOpeningOutcome } from '@/orchestrators/directory-opening.orchestrator';
import { createModProject } from '@/services/mod-creation.service';
import type { CreateModRequest } from '@/shared/types';

export interface CreatedModProject {
  modName: string;
  warnings: string[];
}

export async function createAndOpenModProject(request: CreateModRequest): Promise<CreatedModProject> {
  const created = await createModProject(request);
  const outcome = await openDirectoryTarget(created.modRoot, created.starsectorRoot);
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
  throw new Error('Mod 已创建，但目录识别返回了游戏目录概览');
}
