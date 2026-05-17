import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { darkTheme, lightTheme } from 'naive-ui';

export type AppTheme = 'light' | 'dark';
export type AccentPreset = 'blue' | 'orange' | 'green' | 'cyan' | 'pink' | 'purple' | 'gray' | 'custom';

export interface AccentTone {
  name: string;
  value: AccentPreset;
  hex: string;
}

const STORAGE_KEY = 'starsector-devtool.theme';
const ACCENT_KEY = 'starsector-devtool.accent';
const CUSTOM_ACCENT_KEY = 'starsector-devtool.customAccent';
const HISTORY_LIMIT_KEY = 'starsector-devtool.historyLimit';
const STARSECTOR_ROOT_KEY = 'starsector-devtool.starsectorRoot';
const DEFAULT_HISTORY_LIMIT = 128;
const DEFAULT_ACCENT: AccentPreset = 'blue';
const DEFAULT_CUSTOM_ACCENT = '#2563eb';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const ACCENT_PRESETS: AccentTone[] = [
  { name: '蓝', value: 'blue', hex: '#2563eb' },
  { name: '橙', value: 'orange', hex: '#ea580c' },
  { name: '绿', value: 'green', hex: '#16a34a' },
  { name: '青', value: 'cyan', hex: '#0891b2' },
  { name: '粉', value: 'pink', hex: '#db2777' },
  { name: '紫', value: 'purple', hex: '#7c3aed' },
  { name: '灰', value: 'gray', hex: '#64748b' },
];

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function isAccentPreset(value: string | null): value is AccentPreset {
  return value === 'custom' || ACCENT_PRESETS.some((preset) => preset.value === value);
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

function readStoredAccent(): AccentPreset {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(ACCENT_KEY);
  return isAccentPreset(stored) ? stored : DEFAULT_ACCENT;
}

function readStoredCustomAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_ACCENT;
  return normalizeHex(window.localStorage.getItem(CUSTOM_ACCENT_KEY) ?? '') ?? DEFAULT_CUSTOM_ACCENT;
}

function readStoredHistoryLimit(): number {
  if (typeof window === 'undefined') return DEFAULT_HISTORY_LIMIT;
  const stored = window.localStorage.getItem(HISTORY_LIMIT_KEY);
  if (!stored) return DEFAULT_HISTORY_LIMIT;
  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HISTORY_LIMIT;
}

function readStoredStarsectorRoot(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STARSECTOR_ROOT_KEY) || '';
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<AppTheme>(readStoredTheme());
  const accent = ref<AccentPreset>(readStoredAccent());
  const customAccent = ref(readStoredCustomAccent());
  const historyLimit = ref(readStoredHistoryLimit());
  const starsectorRoot = ref(readStoredStarsectorRoot());
  const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme));
  const isDark = computed(() => theme.value === 'dark');
  const activeAccentHex = computed(() => {
    if (accent.value === 'custom') return customAccent.value;
    return ACCENT_PRESETS.find((preset) => preset.value === accent.value)?.hex ?? DEFAULT_CUSTOM_ACCENT;
  });

  function setTheme(nextTheme: AppTheme) {
    theme.value = nextTheme;
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function setAccent(nextAccent: AccentPreset) {
    accent.value = nextAccent;
  }

  function setCustomAccent(value: string): boolean {
    const normalized = normalizeHex(value);
    if (!normalized) return false;
    customAccent.value = normalized;
    accent.value = 'custom';
    return true;
  }

  function setHistoryLimit(limit: number) {
    historyLimit.value = Math.max(1, Math.min(1000, Math.round(limit)));
  }

  function setStarsectorRoot(path: string) {
    starsectorRoot.value = path;
  }

  watch(
    [theme, activeAccentHex],
    ([themeValue, accentHex]) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = themeValue;
        applyAccentTokens(accentHex, themeValue);
      }
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, themeValue);
    },
    { immediate: true },
  );

  watch(accent, (value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(ACCENT_KEY, value);
  });

  watch(customAccent, (value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(CUSTOM_ACCENT_KEY, value);
  });

  function applyAccentTokens(hex: string, themeValue: AppTheme) {
    if (typeof document === 'undefined') return;
    const isDarkTheme = themeValue === 'dark';
    const hover = mixHex(hex, isDarkTheme ? '#ffffff' : '#000000', isDarkTheme ? 0.18 : 0.12);
    const pressed = mixHex(hex, '#000000', isDarkTheme ? 0.18 : 0.22);
    const soft = mixHex(hex, isDarkTheme ? '#0f1115' : '#ffffff', isDarkTheme ? 0.78 : 0.88);
    const border = mixHex(hex, isDarkTheme ? '#0f1115' : '#ffffff', isDarkTheme ? 0.52 : 0.62);
    const themeColors = isDarkTheme ? darkThemeColors(hex) : lightThemeColors(hex);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(themeColors)) {
      root.style.setProperty(key, value);
    }
    root.style.setProperty('--color-primary', hex);
    root.style.setProperty('--color-primary-hover', hover);
    root.style.setProperty('--color-primary-pressed', pressed);
    root.style.setProperty('--color-primary-soft', soft);
    root.style.setProperty('--color-primary-border', border);
  }

  function lightThemeColors(hex: string): Record<string, string> {
    const hue = hueFromHex(hex);
    return {
      '--color-bg': themedGray(hue, 3, 97),
      '--color-panel': themedGray(hue, 2, 100),
      '--color-panel-muted': themedGray(hue, 3, 95),
      '--color-surface': themedGray(hue, 5, 93),
      '--color-surface-hover': themedGray(hue, 7, 90),
      '--color-surface-active': themedGray(hue, 9, 87),
      '--color-border': themedGray(hue, 6, 85),
      '--color-border-strong': themedGray(hue, 8, 75),
      '--color-text-soft': themedGray(hue, 4, 14),
      '--color-muted': themedGray(hue, 4, 46),
      '--color-faint': themedGray(hue, 3, 64),
      '--color-canvas-bg': themedGray(hue, 7, 5),
      '--scrollbar-thumb': themedGray(hue, 6, 84),
      '--scrollbar-thumb-hover': themedGray(hue, 7, 66),
      '--shadow-floating': `0 24px 70px ${hexToRgba(themedGray(hue, 6, 10), 0.18)}`,
      '--shadow-subtle': `0 1px 2px ${hexToRgba(themedGray(hue, 4, 10), 0.04)}`,
    };
  }

  function darkThemeColors(hex: string): Record<string, string> {
    const hue = hueFromHex(hex);
    return {
      '--color-bg': themedGray(hue, 4, 3),
      '--color-panel': themedGray(hue, 5, 8),
      '--color-panel-muted': themedGray(hue, 5, 6),
      '--color-surface': themedGray(hue, 7, 12),
      '--color-surface-hover': themedGray(hue, 9, 16),
      '--color-surface-active': themedGray(hue, 11, 21),
      '--color-border': themedGray(hue, 8, 19),
      '--color-border-strong': themedGray(hue, 10, 26),
      '--color-text-soft': themedGray(hue, 4, 75),
      '--color-muted': themedGray(hue, 4, 61),
      '--color-faint': themedGray(hue, 4, 43),
      '--color-canvas-bg': themedGray(hue, 7, 5),
      '--scrollbar-thumb': themedGray(hue, 7, 28),
      '--scrollbar-thumb-hover': themedGray(hue, 8, 40),
      '--shadow-floating': '0 24px 80px rgba(0, 0, 0, 0.42)',
      '--shadow-subtle': '0 1px 2px rgba(0, 0, 0, 0.22)',
    };
  }

  function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function mixHex(hex: string, target: string, ratio: number): string {
    const from = hexToRgb(hex);
    const to = hexToRgb(target);
    const mix = {
      r: Math.round(from.r + (to.r - from.r) * ratio),
      g: Math.round(from.g + (to.g - from.g) * ratio),
      b: Math.round(from.b + (to.b - from.b) * ratio),
    };
    return rgbToHex(mix.r, mix.g, mix.b);
  }

  function themedGray(hue: number, saturation: number, lightness: number): string {
    return hslToHex(hue, saturation, lightness);
  }

  function hueFromHex(hex: string): number {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 220;
    if (max === r) return normalizeHue(60 * (((g - b) / delta) % 6));
    if (max === g) return normalizeHue(60 * ((b - r) / delta + 2));
    return normalizeHue(60 * ((r - g) / delta + 4));
  }

  function hslToHex(hue: number, saturation: number, lightness: number): string {
    const s = saturation / 100;
    const l = lightness / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (hue < 60) {
      r = c;
      g = x;
    } else if (hue < 120) {
      r = x;
      g = c;
    } else if (hue < 180) {
      g = c;
      b = x;
    } else if (hue < 240) {
      g = x;
      b = c;
    } else if (hue < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return rgbToHex(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
  }

  function normalizeHue(hue: number): number {
    return ((hue % 360) + 360) % 360;
  }

  function hexToRgb(hex: string) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  watch(historyLimit, (value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(HISTORY_LIMIT_KEY, String(value));
  });

  watch(starsectorRoot, (value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STARSECTOR_ROOT_KEY, value);
  });

  return {
    accent,
    activeAccentHex,
    customAccent,
    historyLimit,
    isDark,
    naiveTheme,
    starsectorRoot,
    theme,
    setAccent,
    setCustomAccent,
    setHistoryLimit,
    setStarsectorRoot,
    setTheme,
    toggleTheme,
  };
});
