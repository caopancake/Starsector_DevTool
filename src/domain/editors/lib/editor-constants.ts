import type { CollapseProps } from 'naive-ui';

export function toOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

export function snapToStep(value: number, step = 0.5) {
  return Math.round(value / step) * step;
}

export const editorCollapseTheme: NonNullable<CollapseProps['themeOverrides']> = {
  itemMargin: '10px 0 0 0',
  titlePadding: '0',
};
