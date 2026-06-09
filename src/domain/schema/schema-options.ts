import type { HydratedSourceOptionGroup, ResourceRef } from '@/shared/types';
import type { FieldSchema } from '@/domain/schema/schema.types';
import { schemaArrayStringValues, schemaKeyValueEntries, schemaStringValue, schemaTagValues } from '@/domain/schema/schema-values';

export interface SelectOption {
  label: string;
  value: string;
  description?: string | null;
  sprite?: string;
  resourceRef?: ResourceRef | null;
  type?: 'group';
  key?: string;
  children?: SelectOption[];
}

export interface FlatSelectOption {
  description?: string | null;
  label: string;
  sprite?: string;
  value: string;
}

export interface SelectOptionGroup {
  key: string;
  label: string;
  options: FlatSelectOption[];
}

const CURRENT_VALUE_OPTION_GROUP = {
  label: '当前值',
  value: '__current',
} as const;

export function resolveEnumSource(source: string | undefined | null): SelectOption[] {
  if (!source) return [];
  if (source.startsWith('enum:')) {
    return source
      .slice(5)
      .split(',')
      .map((v) => ({ label: v.trim(), value: v.trim() }));
  }

  return [];
}

export function selectOptionValueExists(options: SelectOption[], value: string): boolean {
  return options.some((option) => option.value === value || option.children?.some((child) => child.value === value));
}

export function isSelectOptionGroup(option: SelectOption): boolean {
  return option.type === 'group';
}

export function selectOptionText(option: SelectOption): string {
  return option.label || option.value;
}

export function flattenSelectOptions(options: SelectOption[]): FlatSelectOption[] {
  return options.flatMap((option) =>
    isSelectOptionGroup(option) ? (option.children ?? []).map(flatSelectOption) : [flatSelectOption(option)],
  );
}

export function groupSelectOptions(options: SelectOption[]): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = [];
  const ungrouped: FlatSelectOption[] = [];
  for (const option of options) {
    if (isSelectOptionGroup(option)) {
      groups.push({
        key: option.value,
        label: selectOptionText(option),
        options: (option.children ?? []).map(flatSelectOption),
      });
    } else {
      ungrouped.push(flatSelectOption(option));
    }
  }
  if (ungrouped.length > 0) groups.unshift({ key: '__ungrouped', label: '', options: ungrouped });
  return groups;
}

export function includeCurrentSelectOptions(options: SelectOption[], values: string[]): SelectOption[] {
  const seen = new Set<string>();
  const current = values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value) || selectOptionValueExists(options, value)) return false;
      seen.add(value);
      return true;
    })
    .map((value) => ({ label: value, value }));
  if (current.length === 0) return options;
  return [{ type: 'group', ...CURRENT_VALUE_OPTION_GROUP, children: current }, ...options];
}

export function schemaEnumSelectOptions(field: FieldSchema, sourceOptions: SelectOption[]): SelectOption[] {
  if (field.options && field.options.length > 0) return field.options.map((option) => ({ label: option, value: option }));
  return sourceOptions;
}

export function fieldSourceCurrentValues(field: FieldSchema, value: unknown): string[] {
  if (field.type === 'string-array') return schemaArrayStringValues(value);
  if (field.type === 'tag-select') return schemaTagValues(value);
  if (field.type === 'key-value') return schemaKeyValueEntries(value, field.format).map((entry) => entry.key);
  const text = schemaStringValue(value);
  return text ? [text] : [];
}

export function mapSourceGroupsToSelectOptions(groups: HydratedSourceOptionGroup[]): SelectOption[] {
  return groups.map((group) => ({
    type: 'group',
    label: group.label,
    value: group.label,
    children: group.options.map((option) => ({
      label: option.label,
      value: option.value,
      description: option.description,
      sprite: option.sprite,
      resourceRef: option.resourceRef ?? null,
    })),
  }));
}

function flatSelectOption(option: SelectOption): FlatSelectOption {
  return {
    label: selectOptionText(option),
    description: option.description ?? null,
    sprite: option.sprite,
    value: option.value,
  };
}
