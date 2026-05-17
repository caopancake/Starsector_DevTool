<template>
  <div class="table-panel">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in tables.visibleColumns" :key="col">{{ col }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in tables.filteredRows"
          :key="tables.tableRowKey(row, rowIndex)"
          :class="{ selected: tables.selectedRowKey === tables.rowSelectionKey(row) }"
          @click="tables.selectRow(row)"
        >
          <td
            v-for="col in tables.visibleColumns"
            :key="col"
            :class="{ dirty: tables.isDirty(tables.rowSelectionKey(row), col) }"
            @dblclick.stop="startCellEdit(row, col)"
          >
            <input
              v-if="
                tables.editing?.tab === tables.currentTab &&
                tables.editing?.rowKey === tables.rowSelectionKey(row) &&
                tables.editing?.col === col
              "
              ref="cellInputRef"
              v-model="tables.editing.value"
              class="cell-input"
              @blur="tables.finishCellEdit"
              @keydown.enter.prevent="tables.finishCellEdit"
              @keydown.esc.prevent="tables.cancelCellEdit"
            />
            <span v-else>{{ cell(row[col]) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="tables.rows.length > 0 && tables.visibleColumns.length === 0" class="table-empty-note">
      当前表有 {{ tables.rows.length }} 行，但没有可显示列。请检查 CSV 表头。
    </div>
    <div v-else-if="tables.rows.length > 0 && tables.filteredRows.length === 0" class="table-empty-note">
      当前表有 {{ tables.rows.length }} 行，但被搜索或势力过滤隐藏。
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useTablesStore } from '../features/tables/tables-store';
import type { RowData } from '../shared/types';
import { cell } from '../shared/lib/starsector';

const tables = useTablesStore();
const cellInputRef = ref<HTMLInputElement[]>();

function startCellEdit(row: RowData, col: string) {
  tables.startCellEdit(row, col);
  nextTick(() => {
    const els = cellInputRef.value;
    if (els && els.length > 0) els[0].focus();
  });
}
</script>
