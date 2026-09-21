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
    // 原文保留在输入框等待修正；由宿主组件给出告警反馈。
    emit('invalid-json');
  }
}
</script>
