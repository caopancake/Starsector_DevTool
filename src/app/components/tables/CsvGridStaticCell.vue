<template>
  <template v-if="plainMode">
    <span class="csv-cell-value">{{ rawValue }}</span>
  </template>
  <template v-else-if="isListControl">
    <span v-for="value in listValues" :key="value" class="csv-cell-tag">{{ value }}</span>
  </template>
  <template v-else-if="isReferenceControl">
    <img v-if="referenceMatch?.option.sprite" class="csv-cell-thumb" :src="referenceMatch.option.sprite" :alt="displayValue" />
    <span class="csv-cell-value">{{ displayValue }}</span>
    <span class="csv-cell-caret">⌄</span>
  </template>
  <template v-else-if="showsPickerCaret">
    <span class="csv-cell-value">{{ displayValue }}</span>
    <span class="csv-cell-caret">⌄</span>
  </template>
  <template v-else>
    <span class="csv-cell-value">{{ rawValue }}</span>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cell } from '@/shared/lib/starsector';
import type { CsvWindowRow } from '@/shared/types';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { sourceValue } from '@/domain/tables/csv-source-options';
import {
  csvColumnControl,
  csvControlUsesPicker,
  csvListValues,
  isCsvListControl,
  isCsvReferenceControl,
} from '@/domain/tables/csv-column-schema';
import { useSettingsStore } from '@/stores/settings.store';

const props = defineProps<{
  column: CsvGridColumn;
  row: CsvWindowRow;
  sourceIndex: CsvSourceIndex;
}>();

const rawValue = computed(() => cell(props.row.row[props.column.key]));
const settings = useSettingsStore();
const plainMode = computed(() => settings.isPlainEditMode);
const control = computed(() => csvColumnControl(props.column.schema));
const isListControl = computed(() => isCsvListControl(control.value));
const isReferenceControl = computed(() => isCsvReferenceControl(control.value));
const listValues = computed(() => csvListValues(rawValue.value));
const referenceMatch = computed(() => sourceValue(props.sourceIndex, props.column.schema?.source, rawValue.value));
const showsPickerCaret = computed(() => csvControlUsesPicker(control.value) && !isListControl.value && !isReferenceControl.value);
const displayValue = computed(() => referenceMatch.value?.option.label ?? rawValue.value);
</script>
