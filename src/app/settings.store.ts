import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { darkTheme, lightTheme } from 'naive-ui';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'starsector-devtool.theme';

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<AppTheme>(readStoredTheme());
  const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme));
  const isDark = computed(() => theme.value === 'dark');

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.theme = value;
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value);
    },
    { immediate: true },
  );

  return { isDark, naiveTheme, theme, toggleTheme };
});
