export function toOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

export function snapToStep(value: number, step = 0.5) {
  return Math.round(value / step) * step;
}
