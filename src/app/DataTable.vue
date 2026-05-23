<template>
  <CsvGrid
    :editing="tables.editing"
    :is-dirty="tables.isDirty"
    :model="gridModel"
    :selected-row-key="tables.selectedRowKey"
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
import { computed, watch } from 'vue';
import { useTablesStore } from '@/stores/tables.store';
import { useProjectStore } from '@/stores/project.store';
import { createCsvGridModel } from '@/domain/tables/csv-grid-model';
import CsvGrid from '@/app/components/tables/CsvGrid.vue';
import { recordPerformance } from '@/services/performance.service';

const tables = useTablesStore();
const project = useProjectStore();

const gridModel = computed(() =>
  createCsvGridModel(tables.currentTab, tables.visibleColumns, tables.filteredRows, project.activeModData, tables.tableRowKey),
);

watch(
  () => gridModel.value.performanceSample,
  (sample) =>
    recordPerformance('frontend.csvGridModel', sample.ms, {
      columns: sample.columns,
      rows: sample.rows,
      sourceMs: sample.sourceMs,
      table: sample.table,
      widthMs: sample.widthMs,
    }),
  { immediate: true },
);
</script>
