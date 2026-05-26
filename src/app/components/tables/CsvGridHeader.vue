<template>
  <colgroup>
    <col v-for="column in columns" :key="column.key" :class="column.className" :style="{ width: `${column.widthPx}px` }" />
  </colgroup>
  <thead>
    <tr>
      <th v-for="column in columns" :key="column.key" :class="column.className" :title="column.key">
        <span class="csv-th-label">{{ column.schema?.label ?? column.key }}</span>
        <span class="csv-th-resize" @mousedown.prevent="startResize($event, column)" />
      </th>
    </tr>
  </thead>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';

defineProps<{
  columns: CsvGridColumn[];
}>();

const emit = defineEmits<{
  'resize-column': [key: string, width: number];
}>();

let resizeState: { key: string; startX: number; startWidth: number } | null = null;

function startResize(event: MouseEvent, column: CsvGridColumn) {
  resizeState = { key: column.key, startX: event.clientX, startWidth: column.widthPx };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onResizeMove(event: MouseEvent) {
  if (!resizeState) return;
  const delta = event.clientX - resizeState.startX;
  emit('resize-column', resizeState.key, resizeState.startWidth + delta);
}

function onResizeEnd() {
  resizeState = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

onUnmounted(() => {
  if (resizeState) onResizeEnd();
});
</script>
