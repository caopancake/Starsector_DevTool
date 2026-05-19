<template>
  <div class="csv-cell-editor-overlay" :style="overlayStyle" @click.stop @keydown.esc.prevent="$emit('close')">
    <template v-if="plainMode">
      <n-input
        class="schema-cell-control"
        :value="rawValue"
        size="small"
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event)"
      />
    </template>
    <template v-else>
      <n-input-number
        v-if="column.schema?.control === 'number'"
        class="schema-cell-control"
        :value="numberValue"
        :min="column.schema.min"
        :max="column.schema.max"
        :step="column.schema.step ?? 1"
        :show-button="false"
        size="small"
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event == null ? '' : String($event))"
      />
      <n-select
        v-else-if="column.schema?.control === 'boolean'"
        class="schema-cell-control"
        :value="booleanValue"
        :options="booleanOptions"
        size="small"
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event)"
      />
      <n-select
        v-else-if="column.schema?.control === 'enum'"
        class="schema-cell-control"
        :value="rawValue || null"
        :options="column.enumOptions"
        size="small"
        clearable
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event ?? '')"
      />
      <n-select
        v-else-if="column.schema?.control === 'reference'"
        class="schema-cell-control"
        :value="rawValue || null"
        :options="referenceOptions"
        :render-label="renderSelectLabel"
        size="small"
        filterable
        clearable
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event ?? '')"
      />
      <n-select
        v-else-if="column.schema?.control === 'tags' || column.schema?.control === 'multi'"
        class="schema-cell-control"
        :value="listValue"
        :options="tagOptions"
        size="small"
        multiple
        filterable
        tag
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event.join(', '))"
      />
      <n-input
        v-else-if="column.schema?.control === 'path-image' || column.schema?.control === 'color'"
        class="schema-cell-control"
        :value="rawValue"
        size="small"
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event)"
      />
      <n-input
        v-else
        class="schema-cell-control"
        :value="rawValue"
        size="small"
        autofocus
        @blur="$emit('close')"
        @update:value="$emit('update-cell', row.rowKey, column.key, $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { cell } from '@/shared/lib/starsector';
import type { SelectOption } from '@/domain/schema/schema-registry';
import type { CsvGridColumn, CsvGridRow } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { includeCurrentValue, includeCurrentValues, sourceOptions, sourceValueSet } from '@/domain/tables/csv-source-options';
import { useSettingsStore } from '@/stores/settings.store';

const props = defineProps<{
  bounds: { height: number; left: number; top: number; width: number };
  column: CsvGridColumn;
  row: CsvGridRow;
  sourceIndex: CsvSourceIndex;
}>();

defineEmits<{
  close: [];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

const settings = useSettingsStore();
const plainMode = computed(() => settings.isPlainEditMode);

const booleanOptions = [
  { label: 'TRUE', value: 'TRUE' },
  { label: 'FALSE', value: 'FALSE' },
];

const overlayStyle = computed(() => ({
  height: `${props.bounds.height}px`,
  left: `${props.bounds.left}px`,
  top: `${props.bounds.top}px`,
  width: `${props.bounds.width}px`,
}));
const rawValue = computed(() => cell(props.row.row[props.column.key]));
const numberValue = computed(() => {
  const value = Number(rawValue.value);
  return Number.isFinite(value) ? value : null;
});
const booleanValue = computed(() => {
  const value = rawValue.value.trim().toUpperCase();
  if (value === 'TRUE' || value === 'FALSE') return value;
  return value || null;
});
const listValue = computed(() =>
  rawValue.value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);
const referenceOptions = computed(() =>
  includeCurrentValue(
    sourceOptions(props.sourceIndex, props.column.schema?.source),
    sourceValueSet(props.sourceIndex, props.column.schema?.source),
    rawValue.value,
  ),
);
const tagOptions = computed(() =>
  includeCurrentValues(
    sourceOptions(props.sourceIndex, props.column.schema?.source),
    sourceValueSet(props.sourceIndex, props.column.schema?.source),
    listValue.value,
  ),
);

function renderSelectLabel(option: SelectOption & { label?: string; value?: string }) {
  if (!option.sprite) return option.label ?? option.value ?? '';
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, option.label ?? option.value ?? ''),
  ]);
}
</script>
