import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppData, RowData } from '../../shared/types';
import { cell, deepClone } from '../../shared/lib/starsector';
import { loadProject, pickModRoot } from './project.service';

export const useProjectStore = defineStore('project', () => {
  const data = ref<AppData | null>(null);
  const loading = ref(false);

  const projectName = computed(() => cell(data.value?.modInfo?.name) || 'Native Config Tool');
  const isOpen = computed(() => data.value !== null);

  async function pickAndOpenProject(): Promise<AppData | null> {
    const modRoot = await pickModRoot();
    if (!modRoot) return null;
    return openProject(modRoot);
  }

  async function openProject(modRoot: string): Promise<AppData> {
    loading.value = true;
    try {
      const loaded = await loadProject(modRoot);
      data.value = loaded;
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
    data,
    isOpen,
    loading,
    projectName,
    openProject,
    pickAndOpenProject,
    updateProjectileFile,
    updateShipFile,
    updateWeaponFile,
  };
});
