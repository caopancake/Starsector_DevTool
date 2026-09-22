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
    <CsvCellTextEditor
      v-else-if="isTextControl && pickerAnchor"
      :anchor="pickerAnchor"
      :value="rawValue"
      @close="$emit('close')"
      @commit="handleTextCommit"
    />
    <template v-else>
      <template v-if="isListControl">
        <span v-for="value in listValue" :key="value" class="csv-cell-tag" :title="listValueDescription(value)">{{ value }}</span>
      </template>
      <template v-else-if="isReferenceControl">
        <img v-if="sprite" class="csv-cell-thumb" :src="sprite" :alt="displayValue" />
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
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';
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
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useSchemaSelectMedia } from '@/app/composables/tables/use-schema-select-media';
import CsvCellPicker from '@/app/components/tables/CsvCellPicker.vue';
import CsvCellTextEditor from '@/app/components/tables/CsvCellTextEditor.vue';

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
const project = useProjectStore();
const { schemaSelectSprite } = useSchemaSelectMedia();
const inputRef = useTemplateRef<HTMLInputElement>('inputRef');
const pickerAnchor = ref<{ height: number; left: number; top: number; width: number } | null>(null);

// Local buffer for native input — only commits on blur/Enter, avoids reactive cascade during typing.
const localInputValue = ref('');

const rawValue = computed(() => cell(props.row.row[props.column.key]));
const control = computed(() => csvColumnControl(props.column.schema));
const isTextControl = computed(() => control.value === 'text');
const usesNativeInput = computed(() => {
  if (isTextControl.value) return false;
  if (settings.isPlainEditMode) return true;
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

const sprite = computed(() => {
  const match = referenceMatch.value;
  if (!match?.option.resourceRef) return undefined;
  return schemaSelectSprite(project.activeSessionId ?? undefined, match.option.resourceRef);
});

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

function handleTextCommit(value: string) {
  if (value !== rawValue.value) emit('update-cell', props.row.rowKey, props.column.key, value);
  emit('close');
}

function handlePickerUpdate(values: string[]) {
  emit('update-cell', props.row.rowKey, props.column.key, isListControl.value ? formatCsvListValue(values) : (values[0] ?? ''));
}

function listValueDescription(value: string): string | undefined {
  return sourceValue(props.sourceIndex, props.column.schema?.source, value)?.option.description ?? undefined;
}
</script>
