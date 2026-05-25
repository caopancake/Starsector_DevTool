<template>
  <td
    :class="[column.className, { dirty, 'csv-cell-active': active }]"
    :data-column-key="column.key"
    @click.stop="$emit('activate-cell', row, column, $event)"
  >
    <CsvCellFrame ref="frameRef" :active="active" :control="column.schema?.control ?? 'text'">
      <CsvGridCellEditor
        v-if="active"
        :anchor-element="frameElement"
        :column="column"
        :row="row"
        :source-index="sourceIndex"
        @close="$emit('close-active-cell')"
        @update-cell="forwardUpdateCell"
      />
      <CsvGridStaticCell v-else :column="column" :row="row" :source-index="sourceIndex" />
    </CsvCellFrame>
  </td>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CsvWindowRow } from '@/shared/types';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';
import type { CsvSourceIndex } from '@/domain/tables/csv-source-options';
import CsvCellFrame from '@/app/components/tables/CsvCellFrame.vue';
import CsvGridCellEditor from '@/app/components/tables/CsvGridCellEditor.vue';
import CsvGridStaticCell from '@/app/components/tables/CsvGridStaticCell.vue';

defineProps<{
  active: boolean;
  column: CsvGridColumn;
  dirty: boolean;
  row: CsvWindowRow;
  sourceIndex: CsvSourceIndex;
}>();

const frameRef = ref<{ frameRef: HTMLElement | null } | null>(null);
const frameElement = computed(() => frameRef.value?.frameRef ?? null);

const emit = defineEmits<{
  'activate-cell': [row: CsvWindowRow, column: CsvGridColumn, event: MouseEvent];
  'close-active-cell': [];
  'update-cell': [rowKey: string, column: string, value: string];
}>();

function forwardUpdateCell(rowKey: string, column: string, value: string) {
  emit('update-cell', rowKey, column, value);
}
</script>
