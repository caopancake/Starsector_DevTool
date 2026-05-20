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
        @select-row="forwardSelectRow"
      />
    </table>
    <CsvGridCellEditorOverlay
      v-if="activeCell"
      :bounds="activeCell.bounds"
      :column="activeCell.column"
      :row="activeCell.row"
      :source-index="model.sourceIndex"
      @close="clearActiveCell"
      @update-cell="forwardUpdateCell"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ModTableState } from '@/shared/types/workspace.types';
import type { CsvGridColumn, CsvGridModel, CsvGridRow } from '@/domain/tables/csv-grid-model';
import { useCsvGridViewport } from '@/app/composables/use-csv-grid-viewport';
import CsvGridBody from '@/app/components/tables/CsvGridBody.vue';
import CsvGridCellEditorOverlay from '@/app/components/tables/CsvGridCellEditorOverlay.vue';
import CsvGridHeader from '@/app/components/tables/CsvGridHeader.vue';

interface ActiveCell {
  bounds: { height: number; left: number; top: number; width: number };
  column: CsvGridColumn;
  row: CsvGridRow;
}

interface ElementRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface CellTargetElement {
  getBoundingClientRect?: () => ElementRect;
  querySelector?: (selector: string) => { getBoundingClientRect: () => ElementRect } | null;
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

const panelRef = ref<{ getBoundingClientRect: () => ElementRect; scrollLeft: number; scrollTop: number } | null>(null);
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
  () => [props.model, props.selectedRowKey],
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
  repositionActiveCell();
}

function activateCell(row: CsvGridRow, column: CsvGridColumn, event: MouseEvent) {
  forwardSelectRow(row.rowKey);
  const panel = panelRef.value;
  const target = event.currentTarget as CellTargetElement | null;
  const rect = target?.querySelector?.('.csv-static-control')?.getBoundingClientRect() ?? target?.getBoundingClientRect?.();
  const panelRect = panel?.getBoundingClientRect();
  if (!panel || !rect || !panelRect) return;
  activeCell.value = {
    bounds: {
      height: rect.height,
      left: rect.left - panelRect.left + panel.scrollLeft,
      top: rect.top - panelRect.top + panel.scrollTop,
      width: rect.width,
    },
    column,
    row,
  };
}

function repositionActiveCell() {
  const active = activeCell.value;
  if (!active) return;
  const panel = panelRef.value;
  const panelRect = panel?.getBoundingClientRect();
  if (!panel || !panelRect) return;
  const rowKey = active.row.rowKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const columnKey = active.column.key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const selector = `tr[data-row-key="${rowKey}"] td[data-column-key="${columnKey}"] .csv-static-control`;
  const target = (panel as { querySelector?: (selector: string) => { getBoundingClientRect: () => ElementRect } | null }).querySelector?.(
    selector,
  );
  const rect = target?.getBoundingClientRect();
  if (!rect) return;
  activeCell.value = {
    ...active,
    bounds: {
      height: rect.height,
      left: rect.left - panelRect.left + panel.scrollLeft,
      top: rect.top - panelRect.top + panel.scrollTop,
      width: rect.width,
    },
  };
}

function syncViewportMetrics() {
  const panel = panelRef.value as { clientHeight?: number; scrollTop?: number } | null;
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
