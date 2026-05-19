<template>
  <colgroup>
    <col v-for="column in columns" :key="column.key" :class="column.className" :style="{ width: `${column.widthPx}px` }" />
  </colgroup>
  <thead>
    <tr>
      <th v-for="column in columns" :key="column.key" :class="column.className">{{ column.key }}</th>
    </tr>
  </thead>
</template>

<script setup lang="ts">
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';

defineProps<{
  columns: CsvGridColumn[];
}>();
</script>
