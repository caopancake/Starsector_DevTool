<template>
  <div class="csv-cell-editor" @mousedown.stop @click.stop @keydown.esc.prevent="$emit('close')">
    <input
      v-if="usesNativeInput"
      ref="inputRef"
      class="csv-cell-input"
      :value="rawValue"
      @blur="$emit('close')"
      @input="handleNativeInput"
    />
    <template v-else>
      <template v-if="isMultiControl">
        <span v-for="value in listValue" :key="value" class="csv-cell-tag">{{ value }}</span>
      </template>
      <template v-else-if="column.schema?.control === 'reference'">
        <img v-if="referenceMatch?.option.sprite" class="csv-cell-thumb" :src="referenceMatch.option.sprite" :alt="displayValue" />
        <span class="csv-cell-value">{{ displayValue }}</span>
      </template>
      <template v-else>
        <span class="csv-cell-value">{{ displayValue }}</span>
      </template>
      <span class="csv-cell-caret">⌄</span>
      <CsvCellPicker
        v-if="pickerAnchor"
        :anchor="pickerAnchor"
        :multiple="isMultiControl"
        :options="pickerOptions"
        :values="pickerValues"
        @close="$emit('close')"
        @update="handlePickerUpdate"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { cell } from '@/shared/lib/starsector';
import type { CsvGridColumn, CsvGridRow } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { includeCurrentValue, includeCurrentValues, sourceOptions, sourceValue, sourceValueSet } from '@/domain/tables/csv-source-options';
import { useSettingsStore } from '@/stores/settings.store';
import CsvCellPicker from '@/app/components/tables/CsvCellPicker.vue';

const props = defineProps<{
  anchorElement: HTMLElement | null;
  column: CsvGridColumn;
  row: CsvGridRow;
  sourceIndex: CsvSourceIndex;
}>();

const emit = defineEmits<{
  close: [];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

const settings = useSettingsStore();
const plainMode = computed(() => settings.isPlainEditMode);
const inputRef = ref<HTMLInputElement | null>(null);
const pickerAnchor = ref<{ height: number; left: number; top: number; width: number } | null>(null);

const booleanOptions = [
  { label: 'TRUE', value: 'TRUE' },
  { label: 'FALSE', value: 'FALSE' },
];

const rawValue = computed(() => cell(props.row.row[props.column.key]));
const usesNativeInput = computed(() => {
  if (plainMode.value) return true;
  return ['number', 'path-image', 'color', 'text'].includes(props.column.schema?.control ?? 'text');
});
const isMultiControl = computed(() => props.column.schema?.control === 'tags' || props.column.schema?.control === 'multi');
const listValue = computed(() =>
  rawValue.value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);
const pickerOptions = computed(() => {
  if (props.column.schema?.control === 'boolean') return booleanOptions;
  if (props.column.schema?.control === 'enum') return props.column.enumOptions;
  const options = sourceOptions(props.sourceIndex, props.column.schema?.source);
  const valueSet = sourceValueSet(props.sourceIndex, props.column.schema?.source);
  if (isMultiControl.value) return includeCurrentValues(options, valueSet, listValue.value);
  return includeCurrentValue(options, valueSet, rawValue.value);
});
const pickerValues = computed(() => (isMultiControl.value ? listValue.value : rawValue.value ? [rawValue.value] : []));
const referenceMatch = computed(() => sourceValue(props.sourceIndex, props.column.schema?.source, rawValue.value));
const displayValue = computed(() => referenceMatch.value?.option.label ?? rawValue.value);

onMounted(() => {
  nextTick(() => {
    if (usesNativeInput.value) {
      inputRef.value?.focus();
      inputRef.value?.select();
      return;
    }
    const rect = props.anchorElement?.getBoundingClientRect();
    if (!rect) return;
    pickerAnchor.value = { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });
});

function handleNativeInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('update-cell', props.row.rowKey, props.column.key, target?.value ?? '');
}

function handlePickerUpdate(values: string[]) {
  emit('update-cell', props.row.rowKey, props.column.key, isMultiControl.value ? values.join(', ') : (values[0] ?? ''));
}
</script>
