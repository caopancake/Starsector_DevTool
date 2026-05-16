import { computed, onMounted, onUnmounted } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useHistoryStore } from '../history.store';
import { useTablesStore } from '../../tables/tables.store';
import { useProjectStore } from '../../project/project.store';
import { useEditorsStore } from '../../editors/editors.store';
import { useSettingsStore } from '../../../app/settings.store';
import { applyRedo, applyUndo } from '../history.service';

/**
 * Registers global Ctrl+Z/Y handlers for the main interface.
 * Yields to editor modals when they are open.
 * Should be called once in App.vue.
 */
export function useGlobalShortcuts() {
  const history = useHistoryStore();
  const tables = useTablesStore();
  const project = useProjectStore();
  const editorsStore = useEditorsStore();
  const settings = useSettingsStore();

  const { message } = createDiscreteApi(['message'], {
    configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
  });

  function isEditorOpen(): boolean {
    return !!(editorsStore.shipEditorId || editorsStore.weaponEditorId || editorsStore.projectileEditorId);
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Don't intercept if inside input/textarea
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    // Don't intercept if editor modal is open (editor handles its own Ctrl+Z/Y)
    if (isEditorOpen()) return;

    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      doGlobalUndo();
      return;
    }
    if (event.ctrlKey && (event.key === 'y' || (event.key === 'Z' && event.shiftKey))) {
      event.preventDefault();
      doGlobalRedo();
      return;
    }
  }

  function doGlobalUndo() {
    if (!history.canUndo) {
      if (history.undoLabel === '') {
        message.warning('无法继续撤销：有不可逆操作（新建/删除行或贴图覆盖）');
      }
      return;
    }
    const entry = history.undo();
    if (!entry) {
      message.warning('无法继续撤销：有不可逆操作');
      return;
    }
    const tableState = tables.getActiveModTableState();
    const modData = project.activeModData;
    applyUndo(entry, tableState, modData);
  }

  function doGlobalRedo() {
    if (!history.canRedo) return;
    const entry = history.redo();
    if (!entry) return;
    const tableState = tables.getActiveModTableState();
    const modData = project.activeModData;
    applyRedo(entry, tableState, modData);
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
}
