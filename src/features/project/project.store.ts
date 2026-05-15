import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppData, RowData } from '../../shared/types';
import { cell, deepClone } from '../../shared/lib/starsector';
import { loadProject, pickModRoot } from './project.service';

export const useProjectStore = defineStore('project', () => {
  const modsData = ref<Map<string, AppData>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const loading = ref(false);

  /** Active Mod's AppData — backward-compatible computed */
  const data = computed<AppData | null>(() => (activeModRoot.value ? (modsData.value.get(activeModRoot.value) ?? null) : null));

  const projectName = computed(() => cell(data.value?.modInfo?.name) || 'Starsector DevTool');
  const isOpen = computed(() => modsData.value.size > 0);

  function setActiveModRoot(modRoot: string | null) {
    activeModRoot.value = modRoot;
  }

  function getModData(modRoot: string): AppData | null {
    return modsData.value.get(modRoot) ?? null;
  }

  function removeModData(modRoot: string) {
    modsData.value.delete(modRoot);
    if (activeModRoot.value === modRoot) {
      const remaining = [...modsData.value.keys()];
      activeModRoot.value = remaining[0] ?? null;
    }
  }

  async function pickAndOpenProject(): Promise<AppData | null> {
    const modRoot = await pickModRoot();
    if (!modRoot) return null;
    return openProject(modRoot);
  }

  async function openProject(modRoot: string): Promise<AppData> {
    loading.value = true;
    try {
      const loaded = await loadProject(modRoot);
      modsData.value.set(modRoot, loaded);
      activeModRoot.value = modRoot;
      return loaded;
    } finally {
      loading.value = false;
    }
  }

  function updateShipFile(id: string, ship: RowData) {
    if (!data.value) return;
    data.value.shipFiles[id] = deepClone(ship);
  }

  function updateWeaponFile(id: string, weapon: RowData) {
    if (!data.value) return;
    data.value.wpnFiles[id] = deepClone(weapon);
  }

  function updateProjectileFile(id: string, projectile: RowData) {
    if (!data.value) return;
    data.value.projFiles[id] = deepClone(projectile);
  }

  return {
    activeModRoot,
    data,
    isOpen,
    loading,
    modsData,
    projectName,
    getModData,
    openProject,
    pickAndOpenProject,
    removeModData,
    setActiveModRoot,
    updateProjectileFile,
    updateShipFile,
    updateWeaponFile,
  };
});
