<template>
  <div v-if="failures.length > 0" class="mod-opening-failure-list">
    <div v-for="failure in failures" :key="failure.modRoot" class="mod-opening-failure-item">
      <div class="mod-opening-failure-content">
        <strong>{{ failureMessage(failure) }}</strong>
        <span>{{ failure.file?.path ?? failure.modRoot }}</span>
      </div>
      <n-button v-if="failure.file" size="small" secondary type="error" @click="$emit('edit-failure-file', failure)"> 打开文件 </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModOpeningFailure } from '@/shared/types';
import { appendFileReferenceLocation } from '@/shared/lib/errors';

defineProps<{ failures: ModOpeningFailure[] }>();
defineEmits<{
  'edit-failure-file': [failure: ModOpeningFailure];
}>();

function failureMessage(failure: ModOpeningFailure): string {
  const file = failure.file;
  return appendFileReferenceLocation(failure.message, file ? { ...file, message: failure.message } : null);
}
</script>
