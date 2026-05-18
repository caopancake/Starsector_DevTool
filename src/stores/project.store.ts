import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppData, RowData, SkinFile, VariantFile } from '@/shared/types';
import { cell, deepClone } from '@/shared/lib/starsector';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';

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

  function setLoading(value: boolean) {
    loading.value = value;
  }

  function setLoadedModData(modRoot: string, loaded: AppData) {
    modsData.value.set(modRoot, loaded);
    activeModRoot.value = modRoot;
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

  function replaceVariantFiles(modRoot: string, variantFiles: VariantFile[]) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.variantFiles = deepClone(variantFiles);
    modData.variants = groupVariantsByHull(modData.variantFiles);
  }

  function upsertVariantFile(modRoot: string, variant: VariantFile, previousVariantId?: string | null) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    const next = modData.variantFiles.filter((item) => item.variantId !== variant.variantId && item.variantId !== previousVariantId);
    next.push(deepClone(variant));
    next.sort((a, b) => a.hullId.localeCompare(b.hullId) || a.variantId.localeCompare(b.variantId));
    replaceVariantFiles(modRoot, next);
  }

  function deleteVariantFile(modRoot: string, variantId: string) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    replaceVariantFiles(
      modRoot,
      modData.variantFiles.filter((item) => item.variantId !== variantId),
    );
  }

  function replaceSkinFiles(modRoot: string, skinFiles: SkinFile[]) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    modData.skinFiles = deepClone(skinFiles);
  }

  function upsertSkinFile(modRoot: string, skin: SkinFile, previousSkinHullId?: string | null) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    const next = modData.skinFiles.filter((item) => item.skinHullId !== skin.skinHullId && item.skinHullId !== previousSkinHullId);
    next.push(deepClone(skin));
    next.sort((a, b) => a.baseHullId.localeCompare(b.baseHullId) || a.skinHullId.localeCompare(b.skinHullId));
    replaceSkinFiles(modRoot, next);
  }

  function deleteSkinFile(modRoot: string, skinHullId: string) {
    const modData = modsData.value.get(modRoot);
    if (!modData) return;
    replaceSkinFiles(
      modRoot,
      modData.skinFiles.filter((item) => item.skinHullId !== skinHullId),
    );
  }

  return {
    activeModRoot,
    activeModData,
    isOpen,
    loading,
    modsData,
    projectName,
    getModData,
    removeModData,
    deleteVariantFile,
    deleteSkinFile,
    setActiveModRoot,
    setLoadedModData,
    setLoading,
    updateProjectileFile,
    replaceVariantFiles,
    replaceSkinFiles,
    updateShipFile,
    upsertSkinFile,
    upsertVariantFile,
    updateWeaponFile,
  };
});

function groupVariantsByHull(variantFiles: VariantFile[]): Record<string, RowData[]> {
  const grouped: Record<string, RowData[]> = {};
  for (const file of variantFiles) {
    grouped[file.hullId] ||= [];
    grouped[file.hullId].push(deepClone(file.data));
  }
  return grouped;
}
