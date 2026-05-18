import { computed } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useSettingsStore } from '@/stores/settings.store';
import { buildThemeOverrides, discreteConfigProviderProps } from '@/app/theme-overrides';

export function createAppFeedback(apis: Array<'message' | 'dialog'> = ['message', 'dialog']) {
  const settings = useSettingsStore();
  const themeOverrides = computed(() => buildThemeOverrides(settings));
  return createDiscreteApi(apis, {
    configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
  });
}
