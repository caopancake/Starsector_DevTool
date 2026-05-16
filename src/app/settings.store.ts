import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { darkTheme, lightTheme } from 'naive-ui';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'starsector-devtool.theme';
const HISTORY_LIMIT_KEY = 'starsector-devtool.historyLimit';
const DEFAULT_HISTORY_LIMIT = 128;

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function readStoredHistoryLimit(): number {
  if (typeof window === 'undefined') return DEFAULT_HISTORY_LIMIT;
  const stored = window.localStorage.getItem(HISTORY_LIMIT_KEY);
  if (!stored) return DEFAULT_HISTORY_LIMIT;
  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HISTORY_LIMIT;
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<AppTheme>(readStoredTheme());
  const historyLimit = ref(readStoredHistoryLimit());
  const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme));
  const isDark = computed(() => theme.value === 'dark');

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function setHistoryLimit(limit: number) {
    historyLimit.value = Math.max(1, Math.min(1000, Math.round(limit)));
  }

  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.theme = value;
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value);
    },
    { immediate: true },
  );

  watch(historyLimit, (value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(HISTORY_LIMIT_KEY, String(value));
  });

  return { historyLimit, isDark, naiveTheme, theme, setHistoryLimit, toggleTheme };
});
