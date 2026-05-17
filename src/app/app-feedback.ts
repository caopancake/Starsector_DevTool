import { computed } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useSettingsStore } from './settings-store';
import { buildThemeOverrides, discreteConfigProviderProps } from './theme-overrides';

export function createAppFeedback(apis: Array<'message' | 'dialog'> = ['message', 'dialog']) {
  const settings = useSettingsStore();
  const themeOverrides = computed(() => buildThemeOverrides(settings));
  return createDiscreteApi(apis, {
    configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
  });
}
