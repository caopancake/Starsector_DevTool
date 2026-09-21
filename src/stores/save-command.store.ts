import { ref } from 'vue';
import { defineStore } from 'pinia';

type SaveHandler = () => void | Promise<void>;

// Registry of the active Ctrl+S save target in the main window: exactly one surface
// holds the save right at a time.
export const useSaveCommandStore = defineStore('save-command', () => {
  const activeHandler = ref<SaveHandler | null>(null);

  function registerActiveSaveHandler(handler: SaveHandler): void {
    activeHandler.value = handler;
  }

  function unregisterActiveSaveHandler(handler: SaveHandler): void {
    if (activeHandler.value === handler) {
      activeHandler.value = null;
    }
  }

  function dispatchSaveCommand(): boolean {
    if (!activeHandler.value) return false;
    void activeHandler.value();
    return true;
  }

  return {
    registerActiveSaveHandler,
    unregisterActiveSaveHandler,
    dispatchSaveCommand,
  };
});
