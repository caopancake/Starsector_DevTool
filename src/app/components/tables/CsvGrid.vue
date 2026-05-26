<template>
  <div ref="panelRef" class="table-panel" @scroll="handleScroll">
    <table class="data-table" :style="{ width: `${model.totalWidthPx}px`, minWidth: `${model.totalWidthPx}px` }">
      <CsvGridHeader :columns="model.columns" @resize-column="forwardResizeColumn" />
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
import type { CsvGridRowSlot, CsvWindowRow } from '@/shared/types';
import type { ModTableState } from '@/shared/types/workspace.types';
import type { CsvGridColumn, CsvGridModel } from '@/domain/tables/csv-grid-model';
import { useCsvGridViewport } from '@/app/composables/use-csv-grid-viewport';
import CsvGridBody from '@/app/components/tables/CsvGridBody.vue';
import CsvGridHeader from '@/app/components/tables/CsvGridHeader.vue';
import { usePerformanceLogger } from '@/app/composables/use-performance-logger';

interface ActiveCell {
  column: CsvGridColumn;
  row: CsvWindowRow;
}

const props = defineProps<{
  editing: ModTableState['editing'];
  isDirty: (rowKey: string, column: string) => boolean;
  model: CsvGridModel;
  selectedRowKey: string | null;
}>();

const emit = defineEmits<{
  'request-window': [start: number, count: number];
  'resize-column': [key: string, width: number];
  'select-row': [rowKey: string];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

const panelRef = ref<{ clientHeight?: number; scrollTop?: number } | null>(null);
const activeCell = ref<ActiveCell | null>(null);
const performanceLogger = usePerformanceLogger();
const activeCellKey = computed(() =>
  activeCell.value ? { columnKey: activeCell.value.column.key, rowKey: activeCell.value.row.rowKey } : null,
);
const editingIndex = computed(() => {
  const rowKey = props.editing?.rowKey;
  if (!rowKey) return null;
  const index = props.model.rows.findIndex((row) => row.kind === 'row' && row.rowKey === rowKey);
  return index >= 0 ? index : null;
});
const rows = computed(() => props.model.rows);
const viewport = useCsvGridViewport(rows, { editingIndex });
const afterHeight = computed(() => viewport.afterHeight.value);
const beforeHeight = computed(() => viewport.beforeHeight.value);
const visibleRows = computed<CsvGridRowSlot[]>(() => viewport.visibleItems.value);

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
  emit('request-window', viewport.startIndex.value, Math.max(0, viewport.endIndex.value - viewport.startIndex.value));
  clearActiveCell();
}

function activateCell(row: CsvWindowRow, column: CsvGridColumn) {
  performanceLogger.measure('frontend.csvGrid.activateCell', { column: column.key, rowKey: row.rowKey }, () => {
    forwardSelectRow(row.rowKey);
    activeCell.value = {
      column,
      row,
    };
  });
}

function syncViewportMetrics() {
  const panel = panelRef.value;
  viewport.setViewportMetrics({ clientHeight: panel?.clientHeight ?? 0, scrollTop: panel?.scrollTop ?? 0 });
  emit('request-window', viewport.startIndex.value, Math.max(0, viewport.endIndex.value - viewport.startIndex.value));
}

function clearActiveCell() {
  activeCell.value = null;
}

function forwardSelectRow(rowKey: string) {
  performanceLogger.measure('frontend.csvGrid.selectRow', { rowKey }, () => emit('select-row', rowKey));
}

function forwardUpdateCell(rowKey: string, column: string, value: string) {
  performanceLogger.measure('frontend.csvGrid.updateCell', { column, rowKey }, () => emit('update-cell', rowKey, column, value));
}

function forwardResizeColumn(key: string, width: number) {
  emit('resize-column', key, width);
}
</script>
