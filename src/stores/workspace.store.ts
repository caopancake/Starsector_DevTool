import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  ConfigView,
  GameOverviewData,
  ModEntry,
  PersistedWorkspace,
  TableKey,
  WorkspaceColumnWidths,
  WorkspaceView,
} from '@/shared/types';
import { gameModsDirectoryPath } from '@/shared/lib/paths';

interface ModNavigationContext {
  configView: ConfigView;
  currentView: Extract<WorkspaceView, 'config' | 'table'>;
}

function createDefaultModNavigationContext(): ModNavigationContext {
  return { currentView: 'config', configView: 'mod-overview' };
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const mods = ref<Map<string, ModEntry>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const currentView = ref<WorkspaceView>('overview');
  const configView = ref<ConfigView>('mod-overview');
  const modNavigationContexts = ref<Map<string, ModNavigationContext>>(new Map());
  const gameOverview = ref<GameOverviewData | null>(null);
  const columnWidths = ref<WorkspaceColumnWidths>({});

  const activeMod = computed(() => (activeModRoot.value ? (mods.value.get(activeModRoot.value) ?? null) : null));
  const isModView = computed(() => currentView.value === 'config' || currentView.value === 'table');
  const loadedModList = computed(() => [...mods.value.values()]);
  const loadedModCount = computed(() => mods.value.size);
  const hasLoadedMods = computed(() => mods.value.size > 0);
  const hasGameWorkspace = computed(() => gameOverview.value !== null);
  const hasWorkspaceContext = computed(() => hasGameWorkspace.value || hasLoadedMods.value);
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
    modNavigationContexts.value.set(entry.modRoot, createDefaultModNavigationContext());
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

  function removeLoadedModEntry(modRoot: string) {
    mods.value.delete(modRoot);
    modNavigationContexts.value.delete(modRoot);
    cleanupColumnWidthsForMod(modRoot);
    if (activeModRoot.value === modRoot) {
      activeModRoot.value = null;
      currentView.value = 'overview';
      configView.value = 'mod-overview';
    }
  }

  function activateModOverview(modRoot: string) {
    activateModConfig(modRoot, 'mod-overview');
  }

  function activateModTable(modRoot: string) {
    if (!mods.value.has(modRoot)) return;
    activeModRoot.value = modRoot;
    currentView.value = 'table';
    updateModNavigationContext(modRoot, { currentView: 'table' });
  }

  function activateModConfig(modRoot: string, view: ConfigView) {
    if (!mods.value.has(modRoot)) return;
    activeModRoot.value = modRoot;
    currentView.value = 'config';
    configView.value = view;
    updateModNavigationContext(modRoot, { currentView: 'config', configView: view });
  }

  function activateModTab(modRoot: string) {
    if (!mods.value.has(modRoot)) return;
    const context = modNavigationContexts.value.get(modRoot) ?? createDefaultModNavigationContext();
    activeModRoot.value = modRoot;
    currentView.value = context.currentView;
    configView.value = context.configView;
  }

  function showOverview() {
    currentView.value = 'overview';
  }

  function showSettings() {
    currentView.value = 'settings';
  }

  function showAbout() {
    currentView.value = 'about';
  }

  function setGameOverview(overview: GameOverviewData | null) {
    gameOverview.value = overview;
    showOverview();
  }

  function isModImported(modRoot: string): boolean {
    return mods.value.has(modRoot);
  }

  function applyPersistedWorkspaceSnapshot(persisted: PersistedWorkspace) {
    modNavigationContexts.value = new Map();
    for (const mod of persisted.mods) {
      registerMod({ modRoot: mod.modRoot, displayName: mod.displayName, version: mod.version, status: 'loading' });
    }
    activeModRoot.value = null;
    currentView.value = 'overview';
    configView.value = 'mod-overview';
    columnWidths.value = persisted.columnWidths;
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
      starsectorRoot: gameOverview.value?.starsectorRoot ?? null,
      gameMods: gameOverview.value?.mods ?? [],
      gameWarnings: gameOverview.value?.warnings ?? [],
      columnWidths: columnWidths.value,
    };
  }

  function getColumnWidths(modRoot: string, table: TableKey): Record<string, number> | undefined {
    return columnWidths.value[modRoot]?.[table];
  }

  function setColumnWidths(modRoot: string, table: TableKey, widths: Record<string, number>) {
    columnWidths.value = {
      ...columnWidths.value,
      [modRoot]: {
        ...(columnWidths.value[modRoot] ?? {}),
        [table]: widths,
      },
    };
  }

  function cleanupColumnWidthsForMod(modRoot: string) {
    if (!columnWidths.value[modRoot]) return;
    const next = { ...columnWidths.value };
    delete next[modRoot];
    columnWidths.value = next;
  }

  function updateModNavigationContext(modRoot: string, next: Partial<ModNavigationContext>) {
    const previous = modNavigationContexts.value.get(modRoot) ?? createDefaultModNavigationContext();
    modNavigationContexts.value.set(modRoot, { ...previous, ...next });
  }

  return {
    activeModRoot,
    activeMod,
    activateModTab,
    configView,
    currentView,
    gameOverview,
    gameWorkspace,
    hasGameWorkspace,
    hasLoadedMods,
    hasWorkspaceContext,
    loadedModCount,
    loadedModList,
    mods,
    activateModConfig,
    activateModOverview,
    activateModTable,
    applyPersistedWorkspaceSnapshot,
    getColumnWidths,
    isModImported,
    isModView,
    registerMod,
    removeLoadedModEntry,
    setColumnWidths,
    setGameOverview,
    showAbout,
    showOverview,
    showSettings,
    toPersistedState,
    updateModInfo,
    updateModStatus,
  };
});
