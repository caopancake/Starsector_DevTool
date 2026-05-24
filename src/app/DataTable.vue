<template>
  <CsvGrid
    :editing="tables.editing"
    :is-dirty="tables.isDirty"
    :model="gridModel"
    :selected-row-key="tables.selectedRowKey"
    @request-window="loadTableWindow"
    @select-row="tables.selectRowByKey"
    @update-cell="tables.updateCellValueByKey"
  />
  <div v-if="tables.rows.length > 0 && tables.visibleColumns.length === 0" class="table-empty-note">
    当前表有 {{ tables.rows.length }} 行，但没有可显示列。请检查 CSV 表头。
  </div>
  <div v-else-if="tables.rows.length > 0 && tables.filteredRows.length === 0" class="table-empty-note">
    当前表有 {{ tables.rows.length }} 行，但被搜索或势力过滤隐藏。
  </div>
</template>

<script setup lang="ts">
import CsvGrid from '@/app/components/tables/CsvGrid.vue';
import { useCsvTableViewModel } from '@/app/composables/use-csv-table-view-model';

const { tables, gridModel, loadTableWindow } = useCsvTableViewModel();
</script>
