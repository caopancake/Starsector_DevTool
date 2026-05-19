<template>
  <td
    :class="[column.className, { dirty, 'csv-cell-active': active }]"
    :data-column-key="column.key"
    @click.stop="$emit('activate-cell', row, column, $event)"
  >
    <CsvGridStaticCell :column="column" :row="row" :source-index="sourceIndex" />
  </td>
</template>

<script setup lang="ts">
import type { CsvGridColumn, CsvGridRow } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import CsvGridStaticCell from '@/app/components/tables/CsvGridStaticCell.vue';

defineProps<{
  active: boolean;
  column: CsvGridColumn;
  dirty: boolean;
  row: CsvGridRow;
  sourceIndex: CsvSourceIndex;
}>();

defineEmits<{
  'activate-cell': [row: CsvGridRow, column: CsvGridColumn, event: MouseEvent];
}>();
</script>
