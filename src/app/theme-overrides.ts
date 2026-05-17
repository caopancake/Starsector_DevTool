import type { ComputedRef } from 'vue';
import type { GlobalThemeOverrides } from 'naive-ui';
import type { useSettingsStore } from './settings.store';

type SettingsStore = ReturnType<typeof useSettingsStore>;

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function buildThemeOverrides(settings: SettingsStore): GlobalThemeOverrides {
  const panel = cssVar('--color-panel', settings.isDark ? '#171a20' : '#ffffff');
  const surfaceHover = cssVar('--color-surface-hover', settings.isDark ? '#2a2f38' : '#ebebea');
  const surfaceActive = cssVar('--color-surface-active', settings.isDark ? '#323844' : '#e9e8e4');
  const border = cssVar('--color-border', settings.isDark ? '#2c323c' : '#e3e2df');
  const text = cssVar('--color-text', settings.isDark ? '#e6e7eb' : '#1f2328');
  const danger = cssVar('--color-danger', settings.isDark ? '#f87171' : '#dc2626');
  const shadow = cssVar('--shadow-floating', settings.isDark ? '0 24px 80px rgba(0, 0, 0, 0.42)' : '0 24px 70px rgba(15, 23, 42, 0.18)');

  return {
    common: {
      primaryColor: settings.activeAccentHex,
      primaryColorHover: cssVar('--color-primary-hover', settings.activeAccentHex),
      primaryColorPressed: cssVar('--color-primary-pressed', settings.activeAccentHex),
      primaryColorSuppl: settings.activeAccentHex,
    },
    Button: {
      borderRadiusSmall: '5px',
    },
    Message: {
      color: panel,
      colorInfo: panel,
      colorSuccess: panel,
      colorWarning: panel,
      colorError: panel,
      colorLoading: panel,
      textColor: text,
      textColorInfo: text,
      textColorSuccess: text,
      textColorWarning: text,
      textColorError: danger,
      textColorLoading: text,
      iconColorError: danger,
      boxShadow: `${shadow}, inset 0 0 0 1px ${border}`,
      boxShadowInfo: `${shadow}, inset 0 0 0 1px ${border}`,
      boxShadowSuccess: `${shadow}, inset 0 0 0 1px ${border}`,
      boxShadowWarning: `${shadow}, inset 0 0 0 1px ${border}`,
      boxShadowError: `${shadow}, inset 0 0 0 1px ${border}`,
      boxShadowLoading: `${shadow}, inset 0 0 0 1px ${border}`,
      closeColorHover: surfaceHover,
      closeColorHoverError: surfaceHover,
      closeColorPressed: surfaceActive,
      closeColorPressedError: surfaceActive,
      border: '0',
    },
    Switch: {
      railColorActive: settings.activeAccentHex,
    },
  };
}

export function discreteConfigProviderProps(settings: SettingsStore, themeOverrides: ComputedRef<GlobalThemeOverrides>) {
  return {
    theme: settings.naiveTheme,
    themeOverrides: themeOverrides.value,
  };
}
