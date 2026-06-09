import type { ModEntry, ProjectManifest } from '@/shared/types';
import { cell, formatModVersion } from '@/shared/lib/starsector';
import { pathBasename } from '@/shared/lib/paths';
import { useEditorsStore } from '@/stores/editors.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { detectWorkspaceDirectory, openProject } from '@/services/session.service';
import { formatLoadWarnings } from '@/domain/project/load-warnings';
import { measurePerformance } from '@/services/performance.service';
import { navigateToModOverview } from '@/orchestrators/workspace-navigation.orchestrator';

export type DirectoryOpeningOutcome =
  | { type: 'game-overview'; availableModCount: number }
  | { type: 'mod-loaded'; modName: string; warnings: string[] }
  | { type: 'already-loaded'; modName: string }
  | { type: 'unknown'; message: string };

type OpenModResult = { alreadyLoaded: true; displayName: string } | { alreadyLoaded: false; displayName: string; warnings: string[] };
type AfterOpenView = 'overview' | 'mod';

export async function openDirectoryTarget(path: string, knownStarsectorRoot: string | null): Promise<DirectoryOpeningOutcome> {
  const detected = await detectWorkspaceDirectory(path, knownStarsectorRoot);
  const workspace = useWorkspaceStore();

  if (detected.kind === 'game-root' && detected.overview) {
    workspace.setGameOverview(detected.overview);
    return { type: 'game-overview', availableModCount: detected.overview.mods.length };
  }

  if (detected.kind === 'mod-in-game' && detected.modRoot) {
    if (detected.overview) {
      workspace.setGameOverview(detected.overview);
    }
    const loaded = await openModProject(detected.modRoot, detected.starsectorRoot ?? null, 'overview');
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modName: loaded.displayName }
      : { type: 'mod-loaded', modName: loaded.displayName, warnings: loaded.warnings };
  }

  if (detected.kind === 'external-mod' && detected.modRoot) {
    const loaded = await openModProject(detected.modRoot, detected.starsectorRoot ?? null, 'mod');
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modName: loaded.displayName }
      : { type: 'mod-loaded', modName: loaded.displayName, warnings: loaded.warnings };
  }

  return { type: 'unknown', message: detected.warnings[0]?.message ?? '未识别该目录' };
}

export async function openModFromOverview(modRoot: string): Promise<DirectoryOpeningOutcome> {
  const workspace = useWorkspaceStore();
  const starsectorRoot = workspace.gameOverview?.starsectorRoot ?? null;
  const loaded = await openModProject(modRoot, starsectorRoot, 'overview');
  return loaded.alreadyLoaded
    ? { type: 'already-loaded', modName: loaded.displayName }
    : { type: 'mod-loaded', modName: loaded.displayName, warnings: loaded.warnings };
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
    throw error;
  }
}

export async function openModProjectManifest(modRoot: string, starsectorRoot: string | null): Promise<ProjectManifest> {
  const project = useProjectStore();
  project.setLoading(true);
  try {
    const loaded = await openProject(modRoot, starsectorRoot);
    measurePerformance('frontend.project.registerProjectManifest', { modRoot }, () => project.registerProjectManifest(loaded));
    return loaded;
  } finally {
    project.setLoading(false);
  }
}

export function hydrateOpenedModRuntime(modRoot: string, loaded: ProjectManifest, activate: boolean) {
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  if (activate) {
    project.setActiveModRoot(modRoot);
    tables.hydrate(modRoot, loaded);
    editors.activateFor(modRoot);
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
  return displayName;
}

function rollbackFailedModOpening(modRoot: string) {
  const workspace = useWorkspaceStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  workspace.removeLoadedModEntry(modRoot);
  tables.removeModState(modRoot);
  editors.removeModState(modRoot);
  fileHistory.removeModState(modRoot);
  csvEditHistory.clearForMod(modRoot);
  project.removeProjectManifest(modRoot);
  workspace.showOverview();
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
