import { ref } from 'vue';

type SaveHandler = () => void | Promise<void>;

const m_activeHandler = ref<SaveHandler | null>(null);

export function registerActiveSaveHandler(handler: SaveHandler): void {
  m_activeHandler.value = handler;
}

export function unregisterActiveSaveHandler(handler: SaveHandler): void {
  if (m_activeHandler.value === handler) {
    m_activeHandler.value = null;
  }
}

export function dispatchSaveCommand(): boolean {
  if (!m_activeHandler.value) return false;
  void m_activeHandler.value();
  return true;
}
