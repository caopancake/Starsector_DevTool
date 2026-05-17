import { computed, onMounted, onUnmounted } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useSettingsStore } from '../../../app/settings.store';
import { buildThemeOverrides, discreteConfigProviderProps } from '../../../app/theme-overrides';
import { redoMainWindow, undoMainWindow } from '../main-undo-redo.service';

export function useMainWindowShortcuts() {
  const settings = useSettingsStore();
  const themeOverrides = computed(() => buildThemeOverrides(settings));

  const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
    configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
  });

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      void undoMainWindow(message, dialog);
      return;
    }
    if (event.ctrlKey && (event.key === 'y' || (event.key === 'Z' && event.shiftKey))) {
      event.preventDefault();
      void redoMainWindow(message, dialog);
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
}
