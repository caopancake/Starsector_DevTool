import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { darkTheme, lightTheme } from 'naive-ui/es/themes';
import {
  ACCENT_PRESET_VALUES,
  APP_THEMES,
  EDIT_MODES,
  type AccentPreset,
  type AppSettings,
  type AppTheme,
  type EditMode,
} from '@/shared/types';

export interface AccentTone {
  name: string;
  value: AccentPreset;
  hex: string;
}

export interface ThemeColorTokens {
  background: string;
  border: string;
  borderStrong: string;
  canvasBackground: string;
  danger: string;
  dangerBackground: string;
  dangerBorderSoft: string;
  dangerHighlight: string;
  dangerHighlightBorder: string;
  dangerHighlightSoft: string;
  dangerText: string;
  faint: string;
  muted: string;
  onPrimary: string;
  panel: string;
  panelMuted: string;
  primary: string;
  primaryBorder: string;
  primaryHover: string;
  primaryPressed: string;
  primarySoft: string;
  scrollbar: string;
  scrollbarHover: string;
  shadowFloating: string;
  shadowSubtle: string;
  success: string;
  successBackground: string;
  surface: string;
  surfaceActive: string;
  surfaceHover: string;
  text: string;
  textSoft: string;
  warning: string;
  warningBackground: string;
  warningBorder: string;
}

export const MAX_HISTORY_LIMIT = 100;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
let initialSettings: AppSettings | null = null;

export const ACCENT_PRESETS: AccentTone[] = [
  { name: '蓝', value: 'blue', hex: '#2563eb' },
  { name: '橙', value: 'orange', hex: '#ea580c' },
  { name: '绿', value: 'green', hex: '#16a34a' },
  { name: '青', value: 'cyan', hex: '#0891b2' },
  { name: '粉', value: 'pink', hex: '#db2777' },
  { name: '紫', value: 'purple', hex: '#7c3aed' },
  { name: '灰', value: 'gray', hex: '#64748b' },
];

function isAccentPreset(value: string | null): value is AccentPreset {
  return isSharedSettingValue(ACCENT_PRESET_VALUES, value);
}

function isSharedSettingValue<T extends readonly string[]>(values: T, value: string | null): value is T[number] {
  return Boolean(value && values.includes(value));
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function initializeSettingsStore(settings: AppSettings): void {
  assertValidSettings(settings);
  initialSettings = settings;
}

function assertValidSettings(settings: AppSettings): void {
  readTheme(settings.theme);
  readAccent(settings.accent);
  readCustomAccent(settings.customAccent);
  readHistoryLimit(settings.historyLimit);
  readEditMode(settings.editMode);
  readOptionalLogDirectory(settings.logDirectory);
}

function readTheme(value: AppTheme): AppTheme {
  if (!isSharedSettingValue(APP_THEMES, value)) throw new Error(`Invalid app theme: ${value}`);
  return value;
}

function readAccent(value: AccentPreset): AccentPreset {
  if (!isAccentPreset(value)) throw new Error(`Invalid app accent: ${value}`);
  return value;
}

function readCustomAccent(value: string): string {
  const customAccent = normalizeHex(value);
  if (!customAccent) throw new Error(`Invalid custom accent: ${value}`);
  return customAccent;
}

function readHistoryLimit(value: number): number {
  if (!Number.isFinite(value) || value < 1 || value > MAX_HISTORY_LIMIT) throw new Error(`Invalid history limit: ${value}`);
  return Math.round(value);
}

function readEditMode(value: EditMode): EditMode {
  if (!isSharedSettingValue(EDIT_MODES, value)) throw new Error(`Invalid edit mode: ${value}`);
  return value;
}

function readOptionalLogDirectory(value: string | null): string | null {
  if (value === null) return null;
  if (!value.trim()) throw new Error('Invalid log directory: blank');
  return value;
}

export const useSettingsStore = defineStore('settings', () => {
  if (!initialSettings) throw new Error('Settings store used before initialization');
  const theme = ref<AppTheme>(readTheme(initialSettings.theme));
  const accent = ref<AccentPreset>(readAccent(initialSettings.accent));
  const customAccent = ref(readCustomAccent(initialSettings.customAccent));
  const historyLimit = ref(readHistoryLimit(initialSettings.historyLimit));
  const editMode = ref<EditMode>(readEditMode(initialSettings.editMode));
  const starsectorRoot = ref(initialSettings.starsectorRoot);
  const logDirectory = ref(readOptionalLogDirectory(initialSettings.logDirectory));
  const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme));
  const isDark = computed(() => theme.value === 'dark');
  const isPlainEditMode = computed(() => editMode.value === 'plain');
  const activeAccentHex = computed(() => {
    if (accent.value === 'custom') return customAccent.value;
    const preset = ACCENT_PRESETS.find((item) => item.value === accent.value);
    if (!preset) throw new Error(`Invalid app accent: ${accent.value}`);
    return preset.hex;
  });
  const themeColors = computed(() => createThemeColors(activeAccentHex.value, theme.value));

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
    historyLimit.value = Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.round(limit)));
  }

  function setEditMode(mode: EditMode) {
    editMode.value = mode;
  }

  function setStarsectorRoot(path: string | null) {
    starsectorRoot.value = path;
  }

  function setLogDirectory(path: string | null) {
    logDirectory.value = readOptionalLogDirectory(path);
  }

  function settingsSnapshot() {
    return {
      theme: theme.value,
      accent: accent.value,
      customAccent: customAccent.value,
      historyLimit: historyLimit.value,
      editMode: editMode.value,
      starsectorRoot: starsectorRoot.value,
      logDirectory: logDirectory.value,
    };
  }

  function replaceSettings(settings: AppSettings) {
    theme.value = readTheme(settings.theme);
    accent.value = readAccent(settings.accent);
    customAccent.value = readCustomAccent(settings.customAccent);
    historyLimit.value = readHistoryLimit(settings.historyLimit);
    editMode.value = readEditMode(settings.editMode);
    starsectorRoot.value = settings.starsectorRoot;
    logDirectory.value = readOptionalLogDirectory(settings.logDirectory);
  }

  watch(
    themeColors,
    (colors) => {
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.theme = theme.value;
      applyThemeColors(colors);
    },
    { immediate: true },
  );

  function createThemeColors(hex: string, themeValue: AppTheme): ThemeColorTokens {
    const isDarkTheme = themeValue === 'dark';
    const neutralColors = isDarkTheme ? darkThemeColors(hex) : lightThemeColors(hex);
    const primaryHover = mixHex(hex, isDarkTheme ? '#ffffff' : '#000000', isDarkTheme ? 0.18 : 0.12);
    const primaryPressed = mixHex(hex, '#000000', isDarkTheme ? 0.18 : 0.22);
    const primarySoft = mixHex(hex, isDarkTheme ? '#0f1115' : '#ffffff', isDarkTheme ? 0.78 : 0.88);
    const primaryBorder = mixHex(hex, isDarkTheme ? '#0f1115' : '#ffffff', isDarkTheme ? 0.52 : 0.62);

    return {
      background: neutralColors['--color-bg'],
      border: neutralColors['--color-border'],
      borderStrong: neutralColors['--color-border-strong'],
      canvasBackground: neutralColors['--color-canvas-bg'],
      danger: isDarkTheme ? '#f87171' : '#dc2626',
      dangerBackground: isDarkTheme ? '#450a0a' : '#fee2e2',
      dangerBorderSoft: isDarkTheme ? 'rgba(248, 113, 113, 0.28)' : 'rgba(220, 38, 38, 0.28)',
      dangerHighlight: isDarkTheme ? 'rgba(248, 113, 113, 0.16)' : 'rgba(220, 38, 38, 0.16)',
      dangerHighlightBorder: isDarkTheme ? 'rgba(248, 113, 113, 0.35)' : 'rgba(220, 38, 38, 0.35)',
      dangerHighlightSoft: isDarkTheme ? 'rgba(248, 113, 113, 0.12)' : 'rgba(220, 38, 38, 0.12)',
      dangerText: isDarkTheme ? '#fca5a5' : '#991b1b',
      faint: neutralColors['--color-faint'],
      muted: neutralColors['--color-muted'],
      onPrimary: '#ffffff',
      panel: neutralColors['--color-panel'],
      panelMuted: neutralColors['--color-panel-muted'],
      primary: hex,
      primaryBorder,
      primaryHover,
      primaryPressed,
      primarySoft,
      scrollbar: neutralColors['--scrollbar-thumb'],
      scrollbarHover: neutralColors['--scrollbar-thumb-hover'],
      shadowFloating: neutralColors['--shadow-floating'],
      shadowSubtle: neutralColors['--shadow-subtle'],
      success: isDarkTheme ? '#86efac' : '#166534',
      successBackground: isDarkTheme ? '#14532d' : '#dcfce7',
      surface: neutralColors['--color-surface'],
      surfaceActive: neutralColors['--color-surface-active'],
      surfaceHover: neutralColors['--color-surface-hover'],
      text: isDarkTheme ? '#e6e7eb' : '#1f2328',
      textSoft: neutralColors['--color-text-soft'],
      warning: isDarkTheme ? '#fbbf24' : '#b7791f',
      warningBackground: isDarkTheme ? '#3b2d13' : '#fff7df',
      warningBorder: isDarkTheme ? '#6b4d16' : '#f4d58d',
    };
  }

  function applyThemeColors(colors: ThemeColorTokens) {
    const root = document.documentElement;
    const cssTokens: Record<string, string> = {
      '--color-bg': colors.background,
      '--color-panel': colors.panel,
      '--color-panel-muted': colors.panelMuted,
      '--color-surface': colors.surface,
      '--color-surface-hover': colors.surfaceHover,
      '--color-surface-active': colors.surfaceActive,
      '--color-border': colors.border,
      '--color-border-strong': colors.borderStrong,
      '--color-text': colors.text,
      '--color-text-soft': colors.textSoft,
      '--color-muted': colors.muted,
      '--color-faint': colors.faint,
      '--color-primary': colors.primary,
      '--color-primary-hover': colors.primaryHover,
      '--color-primary-pressed': colors.primaryPressed,
      '--color-primary-soft': colors.primarySoft,
      '--color-primary-border': colors.primaryBorder,
      '--color-on-primary': colors.onPrimary,
      '--color-warning': colors.warning,
      '--color-warning-bg': colors.warningBackground,
      '--color-warning-border': colors.warningBorder,
      '--color-danger': colors.danger,
      '--color-success': colors.success,
      '--color-success-bg': colors.successBackground,
      '--color-danger-bg': colors.dangerBackground,
      '--color-danger-text': colors.dangerText,
      '--color-danger-border-soft': colors.dangerBorderSoft,
      '--color-danger-highlight-soft': colors.dangerHighlightSoft,
      '--color-danger-highlight': colors.dangerHighlight,
      '--color-danger-highlight-border': colors.dangerHighlightBorder,
      '--color-canvas-bg': colors.canvasBackground,
      '--scrollbar-thumb': colors.scrollbar,
      '--scrollbar-thumb-hover': colors.scrollbarHover,
      '--shadow-floating': colors.shadowFloating,
      '--shadow-subtle': colors.shadowSubtle,
    };
    for (const [key, value] of Object.entries(cssTokens)) {
      root.style.setProperty(key, value);
    }
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

  return {
    accent,
    activeAccentHex,
    customAccent,
    editMode,
    historyLimit,
    logDirectory,
    isDark,
    isPlainEditMode,
    naiveTheme,
    starsectorRoot,
    theme,
    themeColors,
    setAccent,
    setCustomAccent,
    setEditMode,
    setHistoryLimit,
    setLogDirectory,
    setStarsectorRoot,
    setTheme,
    toggleTheme,
    replaceSettings,
    settingsSnapshot,
  };
});
