<template>
  <div class="schema-form">
    <section v-for="section in sections" :key="section.id" class="settings-section">
      <h3 class="section-header" @click="toggleSection(section.id)">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has(section.id) }">▶</span>
        {{ section.label }}
      </h3>
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
    </section>

    <!-- Extra fields: data keys not defined in schema -->
    <section v-if="extraKeys.length > 0" class="settings-section">
      <h3 class="section-header" @click="toggleSection('__extra')">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has('__extra') }">▶</span>
        额外字段 ({{ extraKeys.length }})
      </h3>
      <div v-show="!collapsedSections.has('__extra')">
        <JsonFieldEditor :model-value="modelValue" :known-keys="schemaKeys" @update:model-value="emit('update:modelValue', $event)" />
      </div>
    </section>
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
  gap: 16px;
}

.section-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.section-chevron {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.15s ease;
  transform: rotate(90deg);
}

.section-chevron.collapsed {
  transform: rotate(0deg);
}

.section-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
