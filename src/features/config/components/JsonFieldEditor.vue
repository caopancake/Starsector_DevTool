<template>
  <div class="json-field-editor">
    <div v-for="key in extraKeys" :key="key" class="json-field-row">
      <span class="json-field-key">{{ key }}</span>
      <n-input
        v-if="typeof modelValue[key] === 'string' || modelValue[key] === null || modelValue[key] === undefined"
        :value="String(modelValue[key] ?? '')"
        size="small"
        @update:value="updateField(key, $event)"
      />
      <n-input-number
        v-else-if="typeof modelValue[key] === 'number'"
        :value="modelValue[key] as number"
        :show-button="false"
        size="small"
        @update:value="updateField(key, $event ?? 0)"
      />
      <n-switch
        v-else-if="typeof modelValue[key] === 'boolean'"
        :value="modelValue[key] as boolean"
        size="small"
        @update:value="updateField(key, $event)"
      />
      <n-input
        v-else
        :value="JSON.stringify(modelValue[key])"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 4 }"
        size="small"
        @update:value="updateJsonField(key, $event)"
      />
      <n-button size="tiny" quaternary @click="removeField(key)">
        <template #icon>&times;</template>
      </n-button>
    </div>
    <div v-if="extraKeys.length === 0" class="json-field-empty">无额外字段</div>
    <div class="json-field-add">
      <n-input v-model:value="newKey" size="small" placeholder="新字段名" style="width: 140px" />
      <n-button size="small" :disabled="!newKey.trim()" @click="addField">添加</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { JsonValue, RowData } from '../../../shared/types';

const props = defineProps<{
  modelValue: RowData;
  knownKeys: string[];
}>();

const emit = defineEmits<{ 'update:modelValue': [data: RowData] }>();

const newKey = ref('');

const extraKeys = computed(() => Object.keys(props.modelValue).filter((k) => !k.startsWith('_') && !props.knownKeys.includes(k)));

function updateField(key: string, value: JsonValue) {
  const updated = { ...props.modelValue, [key]: value };
  emit('update:modelValue', updated);
}

function updateJsonField(key: string, raw: string) {
  try {
    const parsed = JSON.parse(raw) as JsonValue;
    updateField(key, parsed);
  } catch {
    // Keep raw string if not valid JSON
    updateField(key, raw);
  }
}

function removeField(key: string) {
  const updated = { ...props.modelValue };
  delete updated[key];
  emit('update:modelValue', updated);
}

function addField() {
  const key = newKey.value.trim();
  if (!key) return;
  const updated = { ...props.modelValue, [key]: '' };
  emit('update:modelValue', updated);
  newKey.value = '';
}
</script>
