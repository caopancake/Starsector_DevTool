import { defineStore } from 'pinia';

export const useEditorsStore = defineStore('editors', () => {
  function activateFor(modRoot: string | null) {
    void modRoot;
    // Editor windows are independent Tauri windows and no longer need main-window modal state.
  }

  function removeModState(modRoot: string) {
    void modRoot;
    // Kept as a lifecycle hook for workspace cleanup symmetry.
  }

  return {
    activateFor,
    removeModState,
  };
});
