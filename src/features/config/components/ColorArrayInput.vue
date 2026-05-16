<template>
  <div class="color-array-input">
    <n-input-number
      :value="r"
      :min="0"
      :max="255"
      :show-button="false"
      size="small"
      style="width: 60px"
      @update:value="updateChannel(0, $event)"
    />
    <n-input-number
      :value="g"
      :min="0"
      :max="255"
      :show-button="false"
      size="small"
      style="width: 60px"
      @update:value="updateChannel(1, $event)"
    />
    <n-input-number
      :value="b"
      :min="0"
      :max="255"
      :show-button="false"
      size="small"
      style="width: 60px"
      @update:value="updateChannel(2, $event)"
    />
    <span class="color-swatch" :style="{ backgroundColor: hexColor }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { JsonValue } from '../../../shared/types';

const props = defineProps<{ modelValue: JsonValue }>();
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

const arr = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.map(Number);
  return [128, 128, 128];
});

const r = computed(() => arr.value[0] ?? 128);
const g = computed(() => arr.value[1] ?? 128);
const b = computed(() => arr.value[2] ?? 128);
const hexColor = computed(() => `rgb(${r.value}, ${g.value}, ${b.value})`);

function updateChannel(index: number, value: number | null) {
  const next = [...arr.value];
  next[index] = value ?? 0;
  emit('update:modelValue', next);
}
</script>

<style scoped>
.color-array-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-swatch {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
</style>
