<template>
  <div ref="frameRef" :class="['csv-cell-frame', `csv-cell-frame-${control}`, { 'csv-cell-frame-active': active }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CsvColumnControl } from '@/domain/tables/csv-column-schema';

defineProps<{
  active: boolean;
  control: CsvColumnControl | 'text';
}>();

const frameRef = ref<HTMLElement | null>(null);

defineExpose({ frameRef });
</script>
