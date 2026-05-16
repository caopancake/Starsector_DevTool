import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { RowData } from '../../shared/types';
import { deepClone } from '../../shared/lib/starsector';

interface ModConfigState {
  modInfoSnapshot: RowData;
}

function createModConfigState(modInfo: RowData): ModConfigState {
  return { modInfoSnapshot: deepClone(modInfo) };
}

export const useConfigStore = defineStore('config', () => {
  const stateMap = reactive<Map<string, ModConfigState>>(new Map());
  const activeRoot = ref('');

  function getActiveState(): ModConfigState | undefined {
    return stateMap.get(activeRoot.value);
  }

  function activateFor(modRoot: string, modInfo?: RowData) {
    activeRoot.value = modRoot;
    if (!stateMap.has(modRoot) && modInfo) {
      stateMap.set(modRoot, createModConfigState(modInfo));
    }
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function updateSnapshot(modInfo: RowData) {
    const state = getActiveState();
    if (state) {
      state.modInfoSnapshot = deepClone(modInfo);
    }
  }

  const modInfoSnapshot = computed(() => getActiveState()?.modInfoSnapshot ?? {});

  return {
    modInfoSnapshot,
    activateFor,
    removeModState,
    updateSnapshot,
  };
});
