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

  /**
   * Update ship file for a specific mod
   * @param modRoot - The mod to update. If not provided, uses active mod (backward compatible)
   * @param id - Ship ID
   * @param ship - Ship data
   */
  function updateShipFile(modRootOrId: string, idOrShip: string | RowData, ship?: RowData) {
    // Overload: support both updateShipFile(id, ship) and updateShipFile(modRoot, id, ship)
    let modRoot: string | null;
    let id: string;
    let shipData: RowData;

    if (ship !== undefined) {
      // Call form: updateShipFile(modRoot, id, ship)
      modRoot = modRootOrId;
      id = idOrShip as string;
      shipData = ship;
    } else {
      // Call form: updateShipFile(id, ship) - backward compatible, uses active mod
      modRoot = activeModRoot.value;
      id = modRootOrId;
      shipData = idOrShip as RowData;
    }

    if (!modRoot) return;
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.shipFiles[id] = deepClone(shipData);
  }

  /**
   * Update weapon file for a specific mod
   * @param modRoot - The mod to update. If not provided, uses active mod (backward compatible)
   * @param id - Weapon ID
   * @param weapon - Weapon data
   */
  function updateWeaponFile(modRootOrId: string, idOrWeapon: string | RowData, weapon?: RowData) {
    // Overload: support both updateWeaponFile(id, weapon) and updateWeaponFile(modRoot, id, weapon)
    let modRoot: string | null;
    let id: string;
    let weaponData: RowData;

    if (weapon !== undefined) {
      // Call form: updateWeaponFile(modRoot, id, weapon)
      modRoot = modRootOrId;
      id = idOrWeapon as string;
      weaponData = weapon;
    } else {
      // Call form: updateWeaponFile(id, weapon) - backward compatible, uses active mod
      modRoot = activeModRoot.value;
      id = modRootOrId;
      weaponData = idOrWeapon as RowData;
    }

    if (!modRoot) return;
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.wpnFiles[id] = deepClone(weaponData);
  }

  /**
   * Update projectile file for a specific mod
   * @param modRoot - The mod to update. If not provided, uses active mod (backward compatible)
   * @param id - Projectile ID
   * @param projectile - Projectile data
   */
  function updateProjectileFile(modRootOrId: string, idOrProjectile: string | RowData, projectile?: RowData) {
    // Overload: support both updateProjectileFile(id, projectile) and updateProjectileFile(modRoot, id, projectile)
    let modRoot: string | null;
    let id: string;
    let projectileData: RowData;

    if (projectile !== undefined) {
      // Call form: updateProjectileFile(modRoot, id, projectile)
      modRoot = modRootOrId;
      id = idOrProjectile as string;
      projectileData = projectile;
    } else {
      // Call form: updateProjectileFile(id, projectile) - backward compatible, uses active mod
      modRoot = activeModRoot.value;
      id = modRootOrId;
      projectileData = idOrProjectile as RowData;
    }

    if (!modRoot) return;
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.projFiles[id] = deepClone(projectileData);
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
