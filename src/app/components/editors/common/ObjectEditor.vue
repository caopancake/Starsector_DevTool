<template>
  <div class="object-editor">
    <label v-if="title">{{ title }}</label>
    <textarea v-model="text" @change="apply" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    /// Optional text → value hook for hosts that must shape parsed input
    /// (e.g. spec normalization) before it lands in the model.
    parse?: (text: string) => unknown;
  }>(),
  {
    title: '',
    parse: undefined,
  },
);

const emit = defineEmits<{ 'invalid-json': [] }>();

const model = defineModel<unknown>({ default: () => ({}) });

const text = ref(JSON.stringify(model.value || {}, null, 2));

watch(model, (value) => {
  text.value = JSON.stringify(value || {}, null, 2);
});

function apply() {
  try {
    const parse = props.parse ?? ((raw: string) => JSON.parse(raw || '{}'));
    model.value = parse(text.value);
  } catch {
    // Keep the raw text in place for correction; the host component surfaces the warning.
    emit('invalid-json');
  }
}
</script>
