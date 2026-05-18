<template>
  <div class="object-editor">
    <label v-if="title">{{ title }}</label>
    <textarea v-model="text" @change="apply" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RowData } from '@/shared/types';

const props = withDefaults(
  defineProps<{
    modelValue?: RowData;
    title?: string;
  }>(),
  {
    modelValue: () => ({}),
    title: '',
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: RowData] }>();
const text = ref(JSON.stringify(props.modelValue || {}, null, 2));

watch(
  () => props.modelValue,
  (value) => {
    text.value = JSON.stringify(value || {}, null, 2);
  },
);

function apply() {
  try {
    emit('update:modelValue', JSON.parse(text.value || '{}'));
  } catch {
    // Keep the invalid text in place so the user can correct it.
  }
}
</script>
