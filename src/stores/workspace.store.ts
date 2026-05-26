import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  ConfigView,
  GameModSummary,
  GameOverviewData,
  GameScanWarning,
  ModEntry,
  PersistedWorkspace,
  WorkspaceView,
} from '@/shared/types';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';
import { gameModsDirectoryPath } from '@/shared/lib/paths';

export const useWorkspaceStore = defineStore('workspace', () => {
  const mods = ref<Map<string, ModEntry>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const currentView = ref<WorkspaceView>('overview');
  const configView = ref<ConfigView>('mod-overview');
  const expandedMods = ref<Set<string>>(new Set());
  const gameOverview = ref<GameOverviewData | null>(null);
  const columnWidths = ref<Record<string, Record<string, number>>>({});

  const activeMod = computed(() => (activeModRoot.value ? (mods.value.get(activeModRoot.value) ?? null) : null));
  const loadedModList = computed(() => [...mods.value.values()]);
  const loadedModCount = computed(() => mods.value.size);
  const hasLoadedMods = computed(() => mods.value.size > 0);
  const hasGameWorkspace = computed(() => gameOverview.value !== null);
  const hasWorkspaceContext = computed(() => hasGameWorkspace.value || hasLoadedMods.value);
  const modList = loadedModList;
  const modCount = loadedModCount;
  const hasAnyMod = hasLoadedMods;
  const gameWorkspace = computed(() =>
    gameOverview.value
      ? {
          starsectorRoot: gameOverview.value.starsectorRoot,
          coreAvailable: gameOverview.value.coreAvailable,
          mods: gameOverview.value.mods,
          warnings: gameOverview.value.warnings,
          loadedModRoots: loadedModList.value.map((mod) => mod.modRoot),
          activeModRoot: activeModRoot.value,
        }
      : null,
  );

  function registerMod(entry: ModEntry) {
    mods.value.set(entry.modRoot, entry);
    expandedMods.value.add(entry.modRoot);
  }

  function updateModStatus(modRoot: string, status: ModEntry['status'], error?: string) {
    const entry = mods.value.get(modRoot);
    if (!entry) return;
    entry.status = status;
    entry.error = error;
  }

  function updateModInfo(modRoot: string, displayName: string, version: string) {
    const entry = mods.value.get(modRoot);
    if (!entry) return;
    entry.displayName = displayName;
    entry.version = version;
  }

  function removeMod(modRoot: string) {
    mods.value.delete(modRoot);
    expandedMods.value.delete(modRoot);
    cleanupColumnWidthsForMod(modRoot);
    activeModRoot.value = getNextActiveKeyAfterRemoval(activeModRoot.value, [...mods.value.keys()], modRoot, null);
    if (!activeModRoot.value) currentView.value = 'overview';
  }

  function setActiveMod(modRoot: string) {
    if (!mods.value.has(modRoot)) return;
    activeModRoot.value = modRoot;
    currentView.value = 'config';
    configView.value = 'mod-overview';
  }

  function setActiveTable(modRoot: string) {
    if (!mods.value.has(modRoot)) return;
    activeModRoot.value = modRoot;
    currentView.value = 'table';
  }

  function setActiveConfig(modRoot: string, view: ConfigView) {
    if (!mods.value.has(modRoot)) return;
    activeModRoot.value = modRoot;
    currentView.value = 'config';
    configView.value = view;
  }

  function toggleExpanded(modRoot: string) {
    if (expandedMods.value.has(modRoot)) {
      expandedMods.value.delete(modRoot);
    } else {
      expandedMods.value.add(modRoot);
    }
  }

  function navigateTo(view: WorkspaceView) {
    currentView.value = view;
  }

  function setGameOverview(overview: GameOverviewData | null) {
    gameOverview.value = overview;
    currentView.value = 'overview';
  }

  function setGameWorkspace(starsectorRoot: string, coreAvailable: boolean, mods: GameModSummary[], warnings: GameScanWarning[]) {
    setGameOverview({
      starsectorRoot,
      coreAvailable,
      modsDir: gameModsDirectoryPath(starsectorRoot),
      mods,
      warnings,
    });
  }

  function isModImported(modRoot: string): boolean {
    return mods.value.has(modRoot);
  }

  function restoreFrom(persisted: PersistedWorkspace) {
    for (const mod of persisted.mods) {
      registerMod({ modRoot: mod.modRoot, displayName: mod.displayName, version: mod.version, status: 'loading' });
    }
    currentView.value = 'overview';
    configView.value = 'mod-overview';
    expandedMods.value = new Set(persisted.expandedMods);
    columnWidths.value = persisted.columnWidths ?? {};
    if (persisted.starsectorRoot) {
      gameOverview.value = {
        starsectorRoot: persisted.starsectorRoot,
        coreAvailable: true,
        modsDir: gameModsDirectoryPath(persisted.starsectorRoot),
        mods: persisted.gameMods,
        warnings: persisted.gameWarnings,
      };
    }
  }

  function toPersistedState(): PersistedWorkspace {
    return {
      mods: loadedModList.value
        .filter((m) => m.status !== 'error')
        .map((m) => ({ modRoot: m.modRoot, displayName: m.displayName, version: m.version })),
      activeModRoot: activeModRoot.value,
      currentView: currentView.value,
      expandedMods: [...expandedMods.value],
      starsectorRoot: gameOverview.value?.starsectorRoot ?? null,
      gameMods: gameOverview.value?.mods ?? [],
      gameWarnings: gameOverview.value?.warnings ?? [],
      columnWidths: columnWidths.value,
    };
  }

  function getColumnWidths(modRoot: string, table: string): Record<string, number> | undefined {
    return columnWidths.value[`${modRoot}:${table}`];
  }

  function setColumnWidths(modRoot: string, table: string, widths: Record<string, number>) {
    columnWidths.value = { ...columnWidths.value, [`${modRoot}:${table}`]: widths };
  }

  function cleanupColumnWidthsForMod(modRoot: string) {
    const prefix = `${modRoot}:`;
    const current = columnWidths.value;
    const hasEntries = Object.keys(current).some((key) => key.startsWith(prefix));
    if (!hasEntries) return;
    const next: Record<string, Record<string, number>> = {};
    for (const [key, value] of Object.entries(current)) {
      if (!key.startsWith(prefix)) next[key] = value;
    }
    columnWidths.value = next;
  }

  return {
    activeModRoot,
    activeMod,
    configView,
    currentView,
    expandedMods,
    gameOverview,
    gameWorkspace,
    hasGameWorkspace,
    hasLoadedMods,
    hasWorkspaceContext,
    hasAnyMod,
    loadedModCount,
    loadedModList,
    modCount,
    modList,
    mods,
    getColumnWidths,
    isModImported,
    navigateTo,
    registerMod,
    removeMod,
    restoreFrom,
    setActiveConfig,
    setColumnWidths,
    setGameOverview,
    setGameWorkspace,
    setActiveMod,
    setActiveTable,
    toPersistedState,
    toggleExpanded,
    updateModInfo,
    updateModStatus,
  };
});
