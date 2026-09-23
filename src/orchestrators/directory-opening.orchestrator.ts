import type { CreatedMod, ModEntry, ProjectManifest } from '@/shared/types';
import { cell, formatModVersion } from '@/shared/lib/starsector';
import { pathBasename } from '@/shared/lib/paths';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { detectDirectoryTarget, openProject, scanDirectoryGameOverview } from '@/services/session.service';
import { formatLoadWarnings } from '@/domain/project/load-warnings';
import { measurePerformance } from '@/shared/runtime/performance';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { logFields } from '@/shared/lib/log-fields';
import { navigateToModOverview } from '@/orchestrators/workspace-navigation.orchestrator';
import { removeModRuntimeState } from '@/orchestrators/workspace-lifecycle.orchestrator';
import { buildModOpeningFailure } from '@/shared/lib/errors';

export type DirectoryOpeningOutcome =
  | { type: 'game-overview'; root: string; availableModCount: number }
  | { type: 'mod-loaded'; modRoot: string; modName: string; warnings: string[] }
  | { type: 'already-loaded'; modRoot: string; modName: string }
  | { type: 'unknown'; message: string };

type OpenModResult = { alreadyLoaded: true; displayName: string } | { alreadyLoaded: false; displayName: string; warnings: string[] };
type AfterOpenView = 'overview' | 'mod';

export async function openDirectoryTarget(path: string, knownStarsectorRoot: string | null): Promise<DirectoryOpeningOutcome> {
  const detected = await detectDirectoryTarget(path, knownStarsectorRoot);
  const workspace = useWorkspaceStore();

  if (detected.kind === 'game-root' && detected.overview) {
    workspace.clearModOpeningFailures();
    workspace.setGameOverview(detected.overview);
    return { type: 'game-overview', root: detected.overview.starsectorRoot, availableModCount: detected.overview.mods.length };
  }

  if (detected.kind === 'mod-in-game' && detected.modRoot) {
    if (detected.overview) {
      workspace.setGameOverview(detected.overview);
    }
    const loaded = await openModProject(detected.modRoot, detected.starsectorRoot ?? null, 'overview');
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modRoot: detected.modRoot, modName: loaded.displayName }
      : {
          type: 'mod-loaded',
          modRoot: detected.modRoot,
          modName: loaded.displayName,
          warnings: mergeOpeningWarnings(detected.warnings, loaded.warnings),
        };
  }

  if (detected.kind === 'external-mod' && detected.modRoot) {
    const loaded = await openModProject(detected.modRoot, detected.starsectorRoot ?? null, 'mod');
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modRoot: detected.modRoot, modName: loaded.displayName }
      : {
          type: 'mod-loaded',
          modRoot: detected.modRoot,
          modName: loaded.displayName,
          warnings: mergeOpeningWarnings(detected.warnings, loaded.warnings),
        };
  }

  return { type: 'unknown', message: detected.warnings[0]?.message ?? '未识别该目录' };
}

export async function openModFromOverview(modRoot: string): Promise<DirectoryOpeningOutcome> {
  const workspace = useWorkspaceStore();
  const starsectorRoot = workspace.gameOverview?.starsectorRoot ?? null;
  const loaded = await openModProject(modRoot, starsectorRoot, 'mod');
  return loaded.alreadyLoaded
    ? { type: 'already-loaded', modRoot, modName: loaded.displayName }
    : { type: 'mod-loaded', modRoot, modName: loaded.displayName, warnings: loaded.warnings };
}

export async function openCreatedModTarget(created: CreatedMod): Promise<DirectoryOpeningOutcome> {
  const workspace = useWorkspaceStore();
  const afterOpenView: AfterOpenView = created.starsectorRoot ? 'overview' : 'mod';

  if (created.starsectorRoot) {
    const overview = await scanDirectoryGameOverview(created.starsectorRoot);
    workspace.setGameOverview(overview);
  }

  const loaded = await openModProject(created.modRoot, created.starsectorRoot, afterOpenView);
  return loaded.alreadyLoaded
    ? { type: 'already-loaded', modRoot: created.modRoot, modName: loaded.displayName }
    : { type: 'mod-loaded', modRoot: created.modRoot, modName: loaded.displayName, warnings: loaded.warnings };
}

async function openModProject(modRoot: string, starsectorRoot: string | null, afterOpenView: AfterOpenView): Promise<OpenModResult> {
  const workspace = useWorkspaceStore();
  if (workspace.isModImported(modRoot)) {
    if (afterOpenView === 'overview') {
      workspace.showOverview();
    } else {
      navigateToModOverview(modRoot);
    }
    const entry = workspace.mods.get(modRoot);
    return { alreadyLoaded: true, displayName: entry?.displayName ?? modFolderDisplayName(modRoot) };
  }

  workspace.registerMod(createLoadingEntry(modRoot));
  workspace.activateModOverview(modRoot);

  try {
    const loaded = await openModProjectManifest(modRoot, starsectorRoot);
    const displayName = updateLoadedEntry(modRoot, loaded);
    const stillActive = workspace.activeModRoot === modRoot;
    measurePerformance('frontend.hydrateDirectoryOpenedModRuntime', { modRoot, activate: stillActive }, () =>
      hydrateOpenedModRuntime(modRoot, loaded, stillActive),
    );
    if (afterOpenView === 'overview') workspace.showOverview();
    return { alreadyLoaded: false, displayName, warnings: formatLoadWarnings(loaded) };
  } catch (error) {
    rollbackFailedModOpening(modRoot);
    workspace.setModOpeningFailure(buildModOpeningFailure(modRoot, error));
    throw error;
  }
}

export async function openModProjectManifest(modRoot: string, starsectorRoot: string | null): Promise<ProjectManifest> {
  const project = useProjectStore();
  const loaded = await openProject(modRoot, starsectorRoot);
  measurePerformance('frontend.project.registerProjectManifest', { modRoot }, () => project.registerProjectManifest(loaded));
  recordLogBestEffort({
    level: 'info',
    code: 'mod.session_opened',
    message: 'mod session opened',
    path: null,
    line: null,
    fields: logFields({
      modRoot,
      sessionId: loaded.sessionId,
      starsectorRoot: loaded.starsectorRoot,
      name: cell(loaded.modInfo?.name),
      version: formatModVersion(loaded.modInfo?.version),
      warnings: formatLoadWarnings(loaded).length,
    }),
  });
  return loaded;
}

export function hydrateOpenedModRuntime(modRoot: string, loaded: ProjectManifest, activate: boolean) {
  const tables = useTablesStore();
  const fileHistory = useFileHistoryStore();
  if (activate) {
    tables.hydrate(modRoot, loaded);
    fileHistory.activateFor(modRoot);
  } else {
    tables.hydrateWithoutActivate(modRoot, loaded);
  }
}

function updateLoadedEntry(modRoot: string, loaded: ProjectManifest): string {
  const workspace = useWorkspaceStore();
  const displayName = cell(loaded.modInfo?.name) || modFolderDisplayName(modRoot);
  const version = formatModVersion(loaded.modInfo?.version) || '';
  workspace.updateModInfo(modRoot, displayName, version);
  workspace.updateModStatus(modRoot, 'ready');
  workspace.clearModOpeningFailure(modRoot);
  return displayName;
}

function rollbackFailedModOpening(modRoot: string) {
  const workspace = useWorkspaceStore();
  removeModRuntimeState(modRoot);
  workspace.showOverview();
}

function mergeOpeningWarnings(detectedWarnings: { message: string }[], manifestWarnings: string[]): string[] {
  return [...detectedWarnings.map((warning) => warning.message), ...manifestWarnings];
}

function createLoadingEntry(modRoot: string): ModEntry {
  return {
    modRoot,
    displayName: modFolderDisplayName(modRoot),
    version: '',
    status: 'loading',
  };
}

function modFolderDisplayName(modRoot: string): string {
  return pathBasename(modRoot) || 'Mod';
}
