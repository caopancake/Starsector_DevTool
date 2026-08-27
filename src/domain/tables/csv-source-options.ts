import {
  flattenSelectOptions,
  includeCurrentSelectOptions,
  isSelectOptionGroup,
  selectOptionText,
  type SelectOption,
} from '@/domain/schema/schema-options';
import { TABLE_KEYS, type TableKey } from '@/shared/types';

export interface CsvSourceIndex {
  optionsBySource: Map<string, SelectOption[]>;
  valueIndexBySource: Map<string, Map<string, { group: string; option: SelectOption }>>;
  valueSetsBySource: Map<string, Set<string>>;
}

export interface ParsedCsvSource {
  column: string;
  table: TableKey;
}

const EMPTY_OPTIONS: SelectOption[] = [];
const EMPTY_VALUE_SET = new Set<string>();
const tableKeys = new Set<string>(TABLE_KEYS);

export function parseCsvSource(source: string | undefined | null): ParsedCsvSource | null {
  if (!source) return null;
  const trimmed = source.startsWith('csv:') ? source.slice(4) : source;
  const separator = trimmed.indexOf('.');
  if (separator <= 0 || separator === trimmed.length - 1) return null;
  const table = trimmed.slice(0, separator);
  if (!tableKeys.has(table)) return null;
  return { table: table as TableKey, column: trimmed.slice(separator + 1) };
}

export function isCsvSource(source: string | undefined | null): boolean {
  return Boolean(parseCsvSource(source));
}

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
  return value.length > 0 && !existingValues.has(value) ? includeCurrentSelectOptions(options, [value]) : options;
}

export function includeCurrentValues(options: SelectOption[], existingValues: Set<string>, values: string[]): SelectOption[] {
  return includeCurrentSelectOptions(
    options,
    values.filter((value) => !existingValues.has(value)),
  );
}

function createValueIndex(options: SelectOption[]): Map<string, { group: string; option: SelectOption }> {
  const index = new Map<string, { group: string; option: SelectOption }>();
  for (const option of options) {
    if (isSelectOptionGroup(option)) {
      for (const child of option.children ?? []) index.set(child.value, { group: selectOptionText(option), option: child });
    } else {
      index.set(option.value, { group: '', option });
    }
  }
  return index;
}

function createValueSet(options: SelectOption[]): Set<string> {
  const values = new Set<string>();
  for (const option of flattenSelectOptions(options)) values.add(option.value);
  return values;
}
