import { computed, type Ref } from 'vue';
import type { RowData } from '@/shared/types';

export function useObjectField(target: Ref<RowData>) {
  function objectField(key: string): RowData {
    const value = target.value[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
  }

  function bindObjectField(key: string) {
    return computed({
      get: () => objectField(key),
      set: (value) => {
        target.value[key] = value;
      },
    });
  }

  return {
    bindObjectField,
    objectField,
  };
}
