import type { GlobalThemeOverrides } from 'naive-ui/es/config-provider';

function colorToken(name: `--${string}`): string {
  return `var(${name})`;
}

export function buildThemeOverrides(): GlobalThemeOverrides {
  const background = colorToken('--color-bg');
  const panel = colorToken('--color-panel');
  const panelMuted = colorToken('--color-panel-muted');
  const surface = colorToken('--color-surface');
  const surfaceHover = colorToken('--color-surface-hover');
  const surfaceActive = colorToken('--color-surface-active');
  const border = colorToken('--color-border');
  const text = colorToken('--color-text');
  const textSoft = colorToken('--color-text-soft');
  const muted = colorToken('--color-muted');
  const faint = colorToken('--color-faint');
  const primary = colorToken('--color-primary');
  const primaryHover = colorToken('--color-primary-hover');
  const primaryPressed = colorToken('--color-primary-pressed');
  const success = colorToken('--color-success');
  const warning = colorToken('--color-warning');
  const danger = colorToken('--color-danger');
  const scrollbar = colorToken('--scrollbar-thumb');
  const scrollbarHover = colorToken('--scrollbar-thumb-hover');
  const shadow = colorToken('--shadow-floating');

  return {
    common: {
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryPressed,
      primaryColorSuppl: primary,
      infoColor: primary,
      infoColorHover: primaryHover,
      infoColorPressed: primaryPressed,
      infoColorSuppl: primary,
      successColor: success,
      warningColor: warning,
      errorColor: danger,
      textColorBase: text,
      textColor1: text,
      textColor2: textSoft,
      textColor3: muted,
      textColorDisabled: faint,
      placeholderColor: muted,
      placeholderColorDisabled: faint,
      iconColor: muted,
      iconColorHover: textSoft,
      iconColorPressed: text,
      iconColorDisabled: faint,
      dividerColor: border,
      borderColor: border,
      closeIconColor: muted,
      closeIconColorHover: textSoft,
      closeIconColorPressed: text,
      closeColorHover: surfaceHover,
      closeColorPressed: surfaceActive,
      clearColor: muted,
      clearColorHover: textSoft,
      clearColorPressed: text,
      scrollbarColor: scrollbar,
      scrollbarColorHover: scrollbarHover,
      progressRailColor: surfaceActive,
      railColor: surfaceActive,
      popoverColor: panel,
      tableColor: panel,
      cardColor: panel,
      modalColor: panel,
      bodyColor: background,
      inputColor: panel,
      codeColor: surface,
      tabColor: panelMuted,
      actionColor: surface,
      tableHeaderColor: panelMuted,
      hoverColor: surfaceHover,
      tableColorHover: surfaceHover,
      tableColorStriped: panelMuted,
      pressedColor: surfaceActive,
      inputColorDisabled: surface,
      buttonColor2: surface,
      buttonColor2Hover: surfaceHover,
      buttonColor2Pressed: surfaceActive,
      boxShadow1: shadow,
      boxShadow2: shadow,
      boxShadow3: shadow,
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
      railColorActive: primary,
    },
  };
}
