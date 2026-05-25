<template>
  <tbody ref="bodyRef">
    <tr v-if="beforeHeight > 0" class="csv-grid-spacer-row" :style="{ height: `${beforeHeight}px` }">
      <td :colspan="columns.length"></td>
    </tr>
    <template v-for="row in visibleRows" :key="row.kind === 'row' ? row.rowKey : row.slotKey">
      <CsvGridRow
        v-if="row.kind === 'row'"
        :active-cell="activeCell"
        :columns="columns"
        :is-dirty="isDirty"
        :row="row"
        :source-index="sourceIndex"
        @activate-cell="forwardActivateCell"
        @close-active-cell="$emit('close-active-cell')"
        @select-row="selectRow"
        @update-cell="forwardUpdateCell"
      />
      <tr v-else class="csv-grid-placeholder-row">
        <td :colspan="columns.length"></td>
      </tr>
    </template>
    <tr v-if="afterHeight > 0" class="csv-grid-spacer-row" :style="{ height: `${afterHeight}px` }">
      <td :colspan="columns.length"></td>
    </tr>
  </tbody>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue';
import type { CsvGridRowSlot, CsvWindowRow } from '@/shared/types';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import { useTableDomSelection } from '@/app/composables/use-table-dom-selection';
import CsvGridRow from '@/app/components/tables/CsvGridRow.vue';

const props = defineProps<{
  activeCell: { columnKey: string; rowKey: string } | null;
  afterHeight: number;
  beforeHeight: number;
  columns: CsvGridColumn[];
  isDirty: (rowKey: string, column: string) => boolean;
  selectedRowKey: string | null;
  sourceIndex: CsvSourceIndex;
  visibleRows: CsvGridRowSlot[];
}>();

const emit = defineEmits<{
  'activate-cell': [row: CsvWindowRow, column: CsvGridColumn, event: MouseEvent];
  'close-active-cell': [];
  'select-row': [rowKey: string, event: MouseEvent];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

const bodyRef = ref<{
  querySelector: (selector: string) => { classList: { add: (name: string) => void; remove: (name: string) => void } } | null;
} | null>(null);
const { handleRowClick } = useTableDomSelection(bodyRef, toRef(props, 'selectedRowKey'));

function selectRow(rowKey: string, event: MouseEvent) {
  handleRowClick(rowKey, event, (key) => emit('select-row', key, event));
}

function forwardActivateCell(row: CsvWindowRow, column: CsvGridColumn, event: MouseEvent) {
  emit('activate-cell', row, column, event);
}

function forwardUpdateCell(rowKey: string, column: string, value: string) {
  emit('update-cell', rowKey, column, value);
}
</script>
