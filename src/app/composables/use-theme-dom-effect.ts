import { watch } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import type { ThemeColorTokens } from '@/domain/settings/theme';

// 主题 DOM 副作用的唯一归属：store 只持状态，本 effect 把主题令牌写到 document。
// 由 WindowShell（唯一 shell）调用，主窗口与子窗口都经此生效。
export function useThemeDomEffect() {
  const settings = useSettingsStore();
  watch(
    () => ({ colors: settings.themeColors, theme: settings.theme }),
    ({ colors, theme }) => {
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.theme = theme;
      applyThemeColors(colors);
    },
    { immediate: true },
  );
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
