import { describe, expect, it } from 'vitest';
import { fieldSourceCurrentValues, includeCurrentSelectOptions, type SelectOption } from '@/domain/schema/schema-options';
import type { FieldSchema } from '@/domain/schema/schema.types';

const catalog: SelectOption[] = [
  {
    type: 'group',
    label: '当前 Mod',
    value: '当前 Mod',
    children: [{ label: 'Legal', value: 'legal' }],
  },
];

describe('source option ghost values', () => {
  it.each([
    ['enum', ' legacy '],
    ['string-array', ['legal', ' legacy ']],
    ['tag-select', { tags: ['legal', ' legacy '] }],
    ['key-value', { legal: 1, ' legacy ': 2 }],
  ] as const)('preserves exact ghost text for %s', (type, value) => {
    const field = { key: 'value', label: 'Value', type, source: 'csv:ships.id' } as FieldSchema;
    const values = fieldSourceCurrentValues(field, value);
    const options = includeCurrentSelectOptions(catalog, values);
    const ghost = options[0]?.children?.find((option) => option.value === ' legacy ');

    expect(ghost).toEqual({ label: ' legacy ', value: ' legacy ' });
  });

  it('uses character identity and treats only the empty string as unselected', () => {
    const options = includeCurrentSelectOptions(catalog, ['', 'legal', ' legal ', '   ']);
    const ghosts = options[0]?.children?.map((option) => option.value);

    expect(ghosts).toEqual([' legal ', '   ']);
  });
});
