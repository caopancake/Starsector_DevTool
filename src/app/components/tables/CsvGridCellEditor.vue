<template>
  <div class="csv-cell-editor" @mousedown.stop @click.stop @keydown.esc.prevent="$emit('close')">
    <input
      v-if="usesNativeInput"
      ref="inputRef"
      class="csv-cell-input"
      :value="localInputValue"
      @blur="commitAndClose"
      @input="handleNativeInput"
      @keydown.enter.prevent="commitAndClose"
    />
    <template v-else>
      <template v-if="isListControl">
        <span v-for="value in listValue" :key="value" class="csv-cell-tag">{{ value }}</span>
      </template>
      <template v-else-if="isReferenceControl">
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
        :multiple="isListControl"
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
import type { CsvWindowRow } from '@/shared/types';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { includeCurrentValue, includeCurrentValues, sourceOptions, sourceValue, sourceValueSet } from '@/domain/tables/csv-source-options';
import {
  csvBooleanOptions,
  csvColumnControl,
  csvControlUsesNativeInput,
  csvListValues,
  formatCsvListValue,
  isCsvListControl,
  isCsvReferenceControl,
} from '@/domain/tables/csv-column-schema';
import { useSettingsStore } from '@/stores/settings.store';
import CsvCellPicker from '@/app/components/tables/CsvCellPicker.vue';

const props = defineProps<{
  anchorElement: HTMLElement | null;
  column: CsvGridColumn;
  row: CsvWindowRow;
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

// Local buffer for native input — only commits on blur/Enter, avoids reactive cascade during typing.
const localInputValue = ref('');

const rawValue = computed(() => cell(props.row.row[props.column.key]));
const control = computed(() => csvColumnControl(props.column.schema));
const usesNativeInput = computed(() => {
  if (plainMode.value) return true;
  return csvControlUsesNativeInput(control.value);
});
const isListControl = computed(() => isCsvListControl(control.value));
const isReferenceControl = computed(() => isCsvReferenceControl(control.value));
const listValue = computed(() => csvListValues(rawValue.value));
const pickerOptions = computed(() => {
  if (control.value === 'boolean') return csvBooleanOptions();
  if (control.value === 'enum') return props.column.enumOptions;
  const options = sourceOptions(props.sourceIndex, props.column.schema?.source);
  const valueSet = sourceValueSet(props.sourceIndex, props.column.schema?.source);
  if (isListControl.value) return includeCurrentValues(options, valueSet, listValue.value);
  return includeCurrentValue(options, valueSet, rawValue.value);
});
const pickerValues = computed(() => (isListControl.value ? listValue.value : rawValue.value ? [rawValue.value] : []));
const referenceMatch = computed(() => sourceValue(props.sourceIndex, props.column.schema?.source, rawValue.value));
const displayValue = computed(() => referenceMatch.value?.option.label ?? rawValue.value);

onMounted(() => {
  localInputValue.value = rawValue.value;
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
  localInputValue.value = target?.value ?? '';
}

function commitAndClose() {
  if (localInputValue.value !== rawValue.value) {
    emit('update-cell', props.row.rowKey, props.column.key, localInputValue.value);
  }
  emit('close');
}

function handlePickerUpdate(values: string[]) {
  emit('update-cell', props.row.rowKey, props.column.key, isListControl.value ? formatCsvListValue(values) : (values[0] ?? ''));
}
</script>
