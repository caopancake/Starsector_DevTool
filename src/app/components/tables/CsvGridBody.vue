<template>
  <tbody ref="bodyRef">
    <tr v-if="beforeHeight > 0" class="csv-grid-spacer-row" :style="{ height: `${beforeHeight}px` }">
      <td :colspan="columns.length"></td>
    </tr>
    <CsvGridRow
      v-for="row in visibleRows"
      :key="row.rowKey"
      :active-cell="activeCell"
      :columns="columns"
      :is-dirty="isDirty"
      :row="row"
      :source-index="sourceIndex"
      @activate-cell="forwardActivateCell"
      @select-row="selectRow"
    />
    <tr v-if="afterHeight > 0" class="csv-grid-spacer-row" :style="{ height: `${afterHeight}px` }">
      <td :colspan="columns.length"></td>
    </tr>
  </tbody>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue';
import type { CsvGridColumn, CsvGridRow as CsvGridRowData } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { useTableDomSelection } from '@/app/composables/use-table-dom-selection';
import CsvGridRow from '@/app/components/tables/CsvGridRow.vue';

const props = defineProps<{
  activeCell: { columnKey: string; rowKey: string } | null;
  afterHeight: number;
  beforeHeight: number;
  columns: CsvGridColumn[];
  isDirty: (rowKey: string, column: string) => boolean;
  selectedRowKey: string;
  sourceIndex: CsvSourceIndex;
  visibleRows: CsvGridRowData[];
}>();

const emit = defineEmits<{
  'activate-cell': [row: CsvGridRowData, column: CsvGridColumn, event: MouseEvent];
  'select-row': [rowKey: string, event: MouseEvent];
}>();

const bodyRef = ref<{
  querySelector: (selector: string) => { classList: { add: (name: string) => void; remove: (name: string) => void } } | null;
} | null>(null);
const { handleRowClick } = useTableDomSelection(bodyRef, toRef(props, 'selectedRowKey'));

function selectRow(rowKey: string, event: MouseEvent) {
  handleRowClick(rowKey, event, (key) => emit('select-row', key, event));
}

function forwardActivateCell(row: CsvGridRowData, column: CsvGridColumn, event: MouseEvent) {
  emit('activate-cell', row, column, event);
}
</script>
