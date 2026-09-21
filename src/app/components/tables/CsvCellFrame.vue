<template>
  <div ref="frameRef" :class="['csv-cell-frame', `csv-cell-frame-${control}`, { 'csv-cell-frame-active': active }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import type { CsvColumnControl } from '@/domain/schema/schema.types';

defineProps<{
  active: boolean;
  control: CsvColumnControl | 'text';
}>();

const frameRef = useTemplateRef<HTMLElement>('frameRef');

defineExpose({ frameRef });
</script>
