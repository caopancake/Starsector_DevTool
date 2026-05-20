<template>
  <template v-if="plainMode">
    <span class="csv-cell-value">{{ rawValue }}</span>
  </template>
  <template v-else-if="column.schema?.control === 'tags' || column.schema?.control === 'multi'">
    <span v-for="value in listValues" :key="value" class="csv-cell-tag">{{ value }}</span>
  </template>
  <template v-else-if="column.schema?.control === 'reference'">
    <img v-if="referenceMatch?.option.sprite" class="csv-cell-thumb" :src="referenceMatch.option.sprite" :alt="displayValue" />
    <span class="csv-cell-value">{{ displayValue }}</span>
    <span class="csv-cell-caret">⌄</span>
  </template>
  <template v-else-if="isSelectLike">
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
import type { CsvGridColumn, CsvGridRow } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { sourceValue } from '@/domain/tables/csv-source-options';
import { useSettingsStore } from '@/stores/settings.store';

const props = defineProps<{
  column: CsvGridColumn;
  row: CsvGridRow;
  sourceIndex: CsvSourceIndex;
}>();

const rawValue = computed(() => cell(props.row.row[props.column.key]));
const settings = useSettingsStore();
const plainMode = computed(() => settings.isPlainEditMode);
const listValues = computed(() =>
  rawValue.value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);
const referenceMatch = computed(() => sourceValue(props.sourceIndex, props.column.schema?.source, rawValue.value));
const isSelectLike = computed(() => ['boolean', 'enum', 'reference'].includes(props.column.schema?.control ?? ''));
const displayValue = computed(() => referenceMatch.value?.option.label ?? rawValue.value);
</script>
