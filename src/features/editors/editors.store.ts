import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { AppData, ModEditorState, RowData, EditorRef } from '../../shared/types';
import { defaultWeapon, rowId } from '../../shared/lib/starsector';

function createModEditorState(): ModEditorState {
  return { shipEditorId: null, weaponEditorId: null, projectileEditorId: null, previewWeaponId: '' };
}

export const useEditorsStore = defineStore('editors', () => {
  const stateMap = reactive<Map<string, ModEditorState>>(new Map());
  const activeRoot = ref('');
  const fallback = createModEditorState();

  function getActiveState(): ModEditorState {
    if (!activeRoot.value) return fallback;
    let state = stateMap.get(activeRoot.value);
    if (!state) {
      state = createModEditorState();
      stateMap.set(activeRoot.value, state);
    }
    return state;
  }

  // --- Proxy computed for backward-compatible API ---

  const shipEditorId = computed({
    get: () => getActiveState().shipEditorId,
    set: (v) => {
      getActiveState().shipEditorId = v;
    },
  });
  const weaponEditorId = computed({
    get: () => getActiveState().weaponEditorId,
    set: (v) => {
      getActiveState().weaponEditorId = v;
    },
  });
  const projectileEditorId = computed({
    get: () => getActiveState().projectileEditorId,
    set: (v) => {
      getActiveState().projectileEditorId = v;
    },
  });
  const previewWeaponId = computed({
    get: () => getActiveState().previewWeaponId,
    set: (v) => {
      getActiveState().previewWeaponId = v;
    },
  });

  // --- Per-Mod lifecycle ---

  function activateFor(modRoot: string) {
    activeRoot.value = modRoot;
    if (!stateMap.has(modRoot)) {
      stateMap.set(modRoot, createModEditorState());
    }
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
    if (activeRoot.value === modRoot) {
      const remaining = [...stateMap.keys()];
      activeRoot.value = remaining[0] ?? '';
    }
  }

  // --- Existing API ---

  function openShip(id: string) {
    shipEditorId.value = { modRoot: activeRoot.value, id };
  }

  function closeShip() {
    shipEditorId.value = null;
  }

  function openWeapon(id: string) {
    weaponEditorId.value = { modRoot: activeRoot.value, id };
  }

  function closeWeapon() {
    weaponEditorId.value = null;
  }

  function openProjectile(id: string) {
    projectileEditorId.value = { modRoot: activeRoot.value, id };
  }

  function closeProjectile() {
    projectileEditorId.value = null;
  }

  function openPreview(id: string) {
    previewWeaponId.value = id;
  }

  function closePreview() {
    previewWeaponId.value = '';
  }

  function weaponForEditor(appData: AppData | null, weapons: RowData[]): RowData {
    if (!appData || !weaponEditorId.value) return {};
    // Safety: verify editor belongs to this mod
    if (weaponEditorId.value.modRoot !== appData.modRoot) return {};
    const csvRow = weapons.find((weapon) => rowId(weapon) === weaponEditorId.value!.id);
    return appData.wpnFiles[weaponEditorId.value.id] || defaultWeapon(weaponEditorId.value.id, csvRow);
  }

  return {
    projectileEditorId,
    previewWeaponId,
    shipEditorId,
    weaponEditorId,
    activateFor,
    closePreview,
    closeProjectile,
    closeShip,
    closeWeapon,
    openPreview,
    openProjectile,
    openShip,
    openWeapon,
    removeModState,
    weaponForEditor,
  };
});
