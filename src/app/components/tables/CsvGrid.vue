<template>
  <div ref="panelRef" class="table-panel" @scroll="handleScroll">
    <table class="data-table" :style="{ width: `${model.totalWidthPx}px`, minWidth: `${model.totalWidthPx}px` }">
      <CsvGridHeader :columns="model.columns" />
      <CsvGridBody
        :active-cell="activeCellKey"
        :after-height="afterHeight"
        :before-height="beforeHeight"
        :columns="model.columns"
        :is-dirty="isDirty"
        :selected-row-key="selectedRowKey"
        :source-index="model.sourceIndex"
        :visible-rows="visibleRows"
        @activate-cell="activateCell"
        @close-active-cell="clearActiveCell"
        @select-row="forwardSelectRow"
        @update-cell="forwardUpdateCell"
      />
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ModTableState } from '@/shared/types/workspace.types';
import type { CsvGridColumn, CsvGridModel, CsvGridRow } from '@/domain/tables/csv-grid-model';
import { useCsvGridViewport } from '@/app/composables/use-csv-grid-viewport';
import CsvGridBody from '@/app/components/tables/CsvGridBody.vue';
import CsvGridHeader from '@/app/components/tables/CsvGridHeader.vue';

interface ActiveCell {
  column: CsvGridColumn;
  row: CsvGridRow;
}

const props = defineProps<{
  editing: ModTableState['editing'];
  isDirty: (rowKey: string, column: string) => boolean;
  model: CsvGridModel;
  selectedRowKey: string;
}>();

const emit = defineEmits<{
  'select-row': [rowKey: string];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

const panelRef = ref<{ clientHeight?: number; scrollTop?: number } | null>(null);
const activeCell = ref<ActiveCell | null>(null);
const activeCellKey = computed(() =>
  activeCell.value ? { columnKey: activeCell.value.column.key, rowKey: activeCell.value.row.rowKey } : null,
);
const editingIndex = computed(() => {
  const rowKey = props.editing?.rowKey;
  if (!rowKey) return -1;
  return props.model.rows.findIndex((row) => row.rowKey === rowKey);
});
const rows = computed(() => props.model.rows);
const viewport = useCsvGridViewport(rows, { editingIndex });
const afterHeight = computed(() => viewport.afterHeight.value);
const beforeHeight = computed(() => viewport.beforeHeight.value);
const visibleRows = computed(() => viewport.visibleItems.value);

watch(
  () => props.model,
  () => {
    clearActiveCell();
    nextTick(syncViewportMetrics);
  },
);

onMounted(() => {
  nextTick(syncViewportMetrics);
});

function handleScroll(event: Event) {
  viewport.onScroll(event);
  clearActiveCell();
}

function activateCell(row: CsvGridRow, column: CsvGridColumn) {
  forwardSelectRow(row.rowKey);
  activeCell.value = {
    column,
    row,
  };
}

function syncViewportMetrics() {
  const panel = panelRef.value;
  viewport.setViewportMetrics({ clientHeight: panel?.clientHeight ?? 0, scrollTop: panel?.scrollTop ?? 0 });
}

function clearActiveCell() {
  activeCell.value = null;
}

function forwardSelectRow(rowKey: string) {
  emit('select-row', rowKey);
}

function forwardUpdateCell(rowKey: string, column: string, value: string) {
  emit('update-cell', rowKey, column, value);
}
</script>
