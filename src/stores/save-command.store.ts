import { ref } from 'vue';
import { defineStore } from 'pinia';

type SaveHandler = () => void | Promise<void>;

// 主窗口 Ctrl+S 的活动保存目标注册表：同一时刻只有一个表面持有保存权。
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
