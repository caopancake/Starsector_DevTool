import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppData, RowData } from '../../shared/types';
import { cell, deepClone } from '../../shared/lib/starsector';
import { loadProject } from './project-service';
import { getNextActiveKeyAfterRemoval } from '../../shared/lib/store-utils';

export const useProjectStore = defineStore('project', () => {
  const modsData = ref<Map<string, AppData>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const loading = ref(false);

  const activeModData = computed<AppData | null>(() => (activeModRoot.value ? (modsData.value.get(activeModRoot.value) ?? null) : null));

  const projectName = computed(() => cell(activeModData.value?.modInfo?.name) || 'Starsector DevTool');
  const isOpen = computed(() => modsData.value.size > 0);

  function setActiveModRoot(modRoot: string | null) {
    activeModRoot.value = modRoot;
  }

  function getModData(modRoot: string): AppData | null {
    return modsData.value.get(modRoot) ?? null;
  }

  function removeModData(modRoot: string) {
    modsData.value.delete(modRoot);
    activeModRoot.value = getNextActiveKeyAfterRemoval(activeModRoot.value, [...modsData.value.keys()], modRoot, null);
  }

  async function openProject(modRoot: string, starsectorRoot?: string | null): Promise<AppData> {
    loading.value = true;
    try {
      const loaded = await loadProject(modRoot, starsectorRoot);
      modsData.value.set(modRoot, loaded);
      activeModRoot.value = modRoot;
      return loaded;
    } finally {
      loading.value = false;
    }
  }

  function updateShipFile(modRoot: string, id: string, ship: RowData) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.shipFiles[id] = deepClone(ship);
  }

  function updateWeaponFile(modRoot: string, id: string, weapon: RowData) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.wpnFiles[id] = deepClone(weapon);
  }

  function updateProjectileFile(modRoot: string, id: string, projectile: RowData) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.projFiles[id] = deepClone(projectile);
  }

  return {
    activeModRoot,
    activeModData,
    isOpen,
    loading,
    modsData,
    projectName,
    getModData,
    openProject,
    removeModData,
    setActiveModRoot,
    updateProjectileFile,
    updateShipFile,
    updateWeaponFile,
  };
});
