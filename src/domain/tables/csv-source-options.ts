import type { SelectOption } from '@/domain/schema/schema-registry';

export interface CsvSourceIndex {
  optionsBySource: Map<string, SelectOption[]>;
  valueIndexBySource: Map<string, Map<string, { group: string; option: SelectOption }>>;
  valueSetsBySource: Map<string, Set<string>>;
}

const EMPTY_OPTIONS: SelectOption[] = [];
const EMPTY_VALUE_SET = new Set<string>();

export function createCsvSourceIndex(
  sources: Iterable<string | undefined | null>,
  loadedOptions: Map<string, SelectOption[]> = new Map(),
): CsvSourceIndex {
  const optionsBySource = new Map<string, SelectOption[]>();
  const valueIndexBySource = new Map<string, Map<string, { group: string; option: SelectOption }>>();
  const valueSetsBySource = new Map<string, Set<string>>();

  for (const source of sources) {
    if (!source || optionsBySource.has(source)) continue;
    const options: SelectOption[] = loadedOptions.get(source) ?? [];
    optionsBySource.set(source, options);
    valueIndexBySource.set(source, createValueIndex(options));
    valueSetsBySource.set(source, createValueSet(options));
  }

  return { optionsBySource, valueIndexBySource, valueSetsBySource };
}

export function sourceOptions(index: CsvSourceIndex, source: string | undefined | null): SelectOption[] {
  return source ? (index.optionsBySource.get(source) ?? EMPTY_OPTIONS) : EMPTY_OPTIONS;
}

export function sourceValueSet(index: CsvSourceIndex, source: string | undefined | null): Set<string> {
  return source ? (index.valueSetsBySource.get(source) ?? EMPTY_VALUE_SET) : EMPTY_VALUE_SET;
}

export function sourceValue(index: CsvSourceIndex, source: string | undefined | null, value: string) {
  if (!source || !value) return null;
  return index.valueIndexBySource.get(source)?.get(value) ?? null;
}

export function includeCurrentValue(options: SelectOption[], existingValues: Set<string>, value: string): SelectOption[] {
  const trimmed = value.trim();
  if (!trimmed || existingValues.has(trimmed)) return options;
  return [{ type: 'group', label: '当前值', value: '__current', children: [{ label: trimmed, value: trimmed }] }, ...options];
}

export function includeCurrentValues(options: SelectOption[], existingValues: Set<string>, values: string[]): SelectOption[] {
  const missing = values.filter((value) => !existingValues.has(value)).map((value) => ({ label: value, value }));
  if (missing.length === 0) return options;
  return [{ type: 'group', label: '当前值', value: '__current', children: missing }, ...options];
}

function createValueIndex(options: SelectOption[]): Map<string, { group: string; option: SelectOption }> {
  const index = new Map<string, { group: string; option: SelectOption }>();
  for (const option of options) {
    if (option.type === 'group') {
      for (const child of option.children ?? []) index.set(child.value, { group: option.label, option: child });
    } else {
      index.set(option.value, { group: '', option });
    }
  }
  return index;
}

function createValueSet(options: SelectOption[]): Set<string> {
  const values = new Set<string>();
  for (const option of options) {
    values.add(option.value);
    for (const child of option.children ?? []) values.add(child.value);
  }
  return values;
}
