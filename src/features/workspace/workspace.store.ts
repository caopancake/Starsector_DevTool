import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ConfigView, ModEntry, PersistedWorkspace, WorkspaceView } from '../../shared/types';
import { getNextActiveKeyAfterRemoval } from '../../shared/lib/store-utils';

export const useWorkspaceStore = defineStore('workspace', () => {
  const mods = ref<Map<string, ModEntry>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const currentView = ref<WorkspaceView>('overview');
  const configView = ref<ConfigView>('mod-overview');
  const expandedMods = ref<Set<string>>(new Set());

  const activeMod = computed(() => (activeModRoot.value ? (mods.value.get(activeModRoot.value) ?? null) : null));
  const modList = computed(() => [...mods.value.values()]);
  const modCount = computed(() => mods.value.size);
  const hasAnyMod = computed(() => mods.value.size > 0);

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

  function isModImported(modRoot: string): boolean {
    return mods.value.has(modRoot);
  }

  function restoreFrom(persisted: PersistedWorkspace) {
    for (const mod of persisted.mods) {
      registerMod({ modRoot: mod.modRoot, displayName: mod.displayName, version: mod.version, status: 'loading' });
    }
    if (persisted.currentView) currentView.value = persisted.currentView as WorkspaceView;
    expandedMods.value = new Set(persisted.expandedMods);
  }

  function toPersistedState(): PersistedWorkspace {
    return {
      mods: modList.value
        .filter((m) => m.status !== 'error')
        .map((m) => ({ modRoot: m.modRoot, displayName: m.displayName, version: m.version })),
      activeModRoot: activeModRoot.value,
      currentView: currentView.value,
      expandedMods: [...expandedMods.value],
    };
  }

  return {
    activeModRoot,
    activeMod,
    configView,
    currentView,
    expandedMods,
    hasAnyMod,
    modCount,
    modList,
    mods,
    isModImported,
    navigateTo,
    registerMod,
    removeMod,
    restoreFrom,
    setActiveConfig,
    setActiveMod,
    setActiveTable,
    toPersistedState,
    toggleExpanded,
    updateModInfo,
    updateModStatus,
  };
});
