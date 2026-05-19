<template>
  <tr :data-row-key="row.rowKey" @click="$emit('select-row', row.rowKey, $event)">
    <CsvGridCell
      v-for="column in columns"
      :key="column.key"
      :active="activeCell?.rowKey === row.rowKey && activeCell?.columnKey === column.key"
      :column="column"
      :dirty="isDirty(row.rowKey, column.key)"
      :row="row"
      :source-index="sourceIndex"
      @activate-cell="forwardActivateCell"
    />
  </tr>
</template>

<script setup lang="ts">
import type { CsvGridColumn, CsvGridRow } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import CsvGridCell from '@/app/components/tables/CsvGridCell.vue';

defineProps<{
  activeCell: { columnKey: string; rowKey: string } | null;
  columns: CsvGridColumn[];
  isDirty: (rowKey: string, column: string) => boolean;
  row: CsvGridRow;
  sourceIndex: CsvSourceIndex;
}>();

const emit = defineEmits<{
  'activate-cell': [row: CsvGridRow, column: CsvGridColumn, event: MouseEvent];
  'select-row': [rowKey: string, event: MouseEvent];
}>();

function forwardActivateCell(row: CsvGridRow, column: CsvGridColumn, event: MouseEvent) {
  emit('activate-cell', row, column, event);
}
</script>
