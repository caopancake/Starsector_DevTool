<template>
  <div class="object-editor">
    <label v-if="title">{{ title }}</label>
    <textarea v-model="text" @change="apply" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RowData } from '@/shared/types';

withDefaults(defineProps<{ title?: string }>(), {
  title: '',
});

const emit = defineEmits<{ 'invalid-json': [] }>();

const model = defineModel<RowData>({ default: () => ({}) });

const text = ref(JSON.stringify(model.value || {}, null, 2));

watch(model, (value) => {
  text.value = JSON.stringify(value || {}, null, 2);
});

function apply() {
  try {
    model.value = JSON.parse(text.value || '{}');
  } catch {
    // Keep the raw text in place for correction; the host component surfaces the warning.
    emit('invalid-json');
  }
}
</script>
