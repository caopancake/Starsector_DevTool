import type { AppData, ModEntry, PersistedMod } from '@/shared/types';
import { detectDirectory } from '@/shared/api/project-api';
import { cell, formatModVersion } from '@/shared/lib/starsector';
import { useEditorsStore } from '@/stores/editors.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { loadProject } from '@/services/project.service';

export interface OpenDirectoryOutcome {
  type: 'game-overview' | 'mod-loaded' | 'unknown' | 'already-loaded';
  modName?: string;
  availableModCount?: number;
  message?: string;
}

export async function openDetectedDirectory(path: string, fallbackStarsectorRoot: string | null): Promise<OpenDirectoryOutcome> {
  const detected = await detectDirectory(path, fallbackStarsectorRoot);
  const workspace = useWorkspaceStore();

  if (detected.kind === 'game-root' && detected.overview) {
    workspace.setGameOverview(detected.overview);
    return { type: 'game-overview', availableModCount: detected.overview.mods.length };
  }

  if (detected.kind === 'mod-in-game' && detected.modRoot) {
    if (detected.overview) {
      workspace.setGameOverview(detected.overview);
    }
    const loaded = await loadWorkspaceMod(detected.modRoot, detected.starsectorRoot ?? null, true);
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modName: loaded.displayName }
      : { type: 'mod-loaded', modName: loaded.displayName };
  }

  if (detected.kind === 'external-mod' && detected.modRoot) {
    const loaded = await loadWorkspaceMod(detected.modRoot, detected.starsectorRoot ?? null, false);
    return loaded.alreadyLoaded
      ? { type: 'already-loaded', modName: loaded.displayName }
      : { type: 'mod-loaded', modName: loaded.displayName };
  }

  return { type: 'unknown', message: detected.warnings[0]?.message ?? '未识别该目录' };
}

export async function loadModFromOverview(modRoot: string): Promise<OpenDirectoryOutcome> {
  const workspace = useWorkspaceStore();
  const starsectorRoot = workspace.gameOverview?.starsectorRoot ?? null;
  const loaded = await loadWorkspaceMod(modRoot, starsectorRoot, true);
  return loaded.alreadyLoaded
    ? { type: 'already-loaded', modName: loaded.displayName }
    : { type: 'mod-loaded', modName: loaded.displayName };
}

export async function restoreWorkspaceMod(mod: PersistedMod, starsectorRoot: string | null): Promise<AppData> {
  const loaded = await loadProjectData(mod.modRoot, starsectorRoot);
  hydrateLoadedMod(mod.modRoot, loaded, false);
  return loaded;
}

async function loadWorkspaceMod(modRoot: string, starsectorRoot: string | null, stayOnOverview: boolean) {
  const workspace = useWorkspaceStore();
  if (workspace.isModImported(modRoot)) {
    if (stayOnOverview) {
      workspace.navigateTo('overview');
    } else {
      workspace.setActiveMod(modRoot);
    }
    const entry = workspace.mods.get(modRoot);
    return { alreadyLoaded: true, displayName: entry?.displayName ?? fallbackName(modRoot) };
  }

  workspace.registerMod(createLoadingEntry(modRoot));
  workspace.setActiveMod(modRoot);

  try {
    const loaded = await loadProjectData(modRoot, starsectorRoot);
    const displayName = updateLoadedEntry(modRoot, loaded);
    hydrateLoadedMod(modRoot, loaded, true);
    if (stayOnOverview) workspace.navigateTo('overview');
    return { alreadyLoaded: false, displayName };
  } catch (error) {
    rollbackFailedModLoad(modRoot);
    throw error;
  }
}

async function loadProjectData(modRoot: string, starsectorRoot: string | null): Promise<AppData> {
  const project = useProjectStore();
  project.setLoading(true);
  try {
    const loaded = await loadProject(modRoot, starsectorRoot);
    project.setLoadedModData(modRoot, loaded);
    return loaded;
  } finally {
    project.setLoading(false);
  }
}

function hydrateLoadedMod(modRoot: string, loaded: AppData, activate: boolean) {
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  if (activate) {
    tables.hydrate(modRoot, loaded);
    editors.activateFor(modRoot);
    fileHistory.activateFor(modRoot);
  } else {
    tables.hydrateWithoutActivate(modRoot, loaded);
  }
}

function updateLoadedEntry(modRoot: string, loaded: AppData): string {
  const workspace = useWorkspaceStore();
  const displayName = cell(loaded.modInfo?.name) || fallbackName(modRoot);
  const version = formatModVersion(loaded.modInfo?.version) || '';
  workspace.updateModInfo(modRoot, displayName, version);
  workspace.updateModStatus(modRoot, 'ready');
  return displayName;
}

function rollbackFailedModLoad(modRoot: string) {
  const workspace = useWorkspaceStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  workspace.removeMod(modRoot);
  tables.removeModState(modRoot);
  editors.removeModState(modRoot);
  fileHistory.removeModState(modRoot);
  csvEditHistory.clearForMod(modRoot);
  project.removeModData(modRoot);
  workspace.navigateTo('overview');
}

function createLoadingEntry(modRoot: string): ModEntry {
  return {
    modRoot,
    displayName: fallbackName(modRoot),
    version: '',
    status: 'loading',
  };
}

function fallbackName(modRoot: string): string {
  return modRoot.split(/[\\/]/).pop() || 'Mod';
}
