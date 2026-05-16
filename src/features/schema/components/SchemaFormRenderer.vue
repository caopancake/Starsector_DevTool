<template>
  <div class="schema-form">
    <div v-for="section in sections" :key="section.id" class="schema-section">
      <div class="section-header" @click="toggleSection(section.id)">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has(section.id) }">▶</span>
        {{ section.label }}
      </div>
      <div v-show="!collapsedSections.has(section.id)" class="section-fields">
        <SchemaFieldRenderer
          v-for="field in section.fields"
          :key="field.key"
          :field="field"
          :value="getNestedValue(modelValue, field.key)"
          :app-data="appData"
          @update="onFieldUpdate(field.key, $event)"
        />
      </div>
    </div>

    <!-- Extra fields: data keys not defined in schema -->
    <div v-if="extraKeys.length > 0" class="schema-section">
      <div class="section-header" @click="toggleSection('__extra')">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has('__extra') }">▶</span>
        额外字段 ({{ extraKeys.length }})
      </div>
      <div v-show="!collapsedSections.has('__extra')" class="section-fields">
        <JsonFieldEditor :model-value="modelValue" :known-keys="schemaKeys" @update:model-value="emit('update:modelValue', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { AppData, RowData } from '../../../shared/types';
import type { FileSchema, SectionSchema } from '../schema.types';
import { getSections, getSchemaKeys, getNestedValue, setNestedValue } from '../schema.service';
import SchemaFieldRenderer from './SchemaFieldRenderer.vue';
import JsonFieldEditor from '../../config/components/JsonFieldEditor.vue';

const props = defineProps<{
  schema: FileSchema;
  modelValue: RowData;
  appData: AppData | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: RowData];
}>();

const sections = computed<SectionSchema[]>(() => getSections(props.schema));

const schemaKeys = computed<string[]>(() => getSchemaKeys(props.schema));

const extraKeys = computed<string[]>(() =>
  Object.keys(props.modelValue).filter((k) => !k.startsWith('_') && !schemaKeys.value.includes(k)),
);

// Track collapsed state
const collapsedSections = reactive(new Set<string>());

// Initialize collapsed state from schema defaults
const initCollapsed = () => {
  for (const section of sections.value) {
    if (section.collapsed) {
      collapsedSections.add(section.id);
    }
  }
};
initCollapsed();

function toggleSection(id: string) {
  if (collapsedSections.has(id)) {
    collapsedSections.delete(id);
  } else {
    collapsedSections.add(id);
  }
}

function onFieldUpdate(key: string, value: unknown) {
  const updated = setNestedValue(props.modelValue, key, value);
  emit('update:modelValue', updated);
}
</script>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.schema-section {
  background: var(--color-panel-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 6px;
  overflow: hidden;
}

.section-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-soft);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;
}

.section-header:hover {
  background: var(--color-surface-hover);
}

.section-chevron {
  display: inline-block;
  font-size: 9px;
  transition: transform 0.15s ease;
  transform: rotate(90deg);
  color: var(--color-muted);
}

.section-chevron.collapsed {
  transform: rotate(0deg);
}

.section-fields {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 0;
}
</style>
