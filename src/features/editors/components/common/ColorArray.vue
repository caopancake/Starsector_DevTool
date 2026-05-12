<template>
  <div class="color-array">
    <strong>{{ label }}</strong>
    <input v-for="index in [0, 1, 2, 3]" :key="index" type="number" min="0" max="255" :value="channel(index)" @input="set(index, $event)" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    modelValue?: number[];
  }>(),
  {
    modelValue: () => [255, 255, 255, 255],
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

function channel(index: number): number {
  return props.modelValue[index] ?? 255;
}

function set(index: number, event: Event) {
  const next = [...props.modelValue];
  next[index] = Number((event.target as HTMLInputElement).value) || 0;
  emit('update:modelValue', next);
}
</script>
