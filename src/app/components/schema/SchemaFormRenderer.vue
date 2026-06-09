<template>
  <div class="schema-form">
    <div v-for="section in sections" :key="section.id" class="schema-section">
      <div class="section-header" @click="toggleSection(section.id)">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has(section.id) }">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
        {{ section.label }}
      </div>
      <div v-show="!collapsedSections.has(section.id)" class="section-fields">
        <SchemaFieldRenderer
          v-for="field in section.fields"
          :key="field.key"
          :field="field"
          :value="getNestedValue(modelValue, field.key)"
          :runtime-context="runtimeContext"
          @update="onFieldUpdate(field.key, $event)"
        />
      </div>
    </div>

    <!-- Extra fields: data keys not defined in schema -->
    <div v-if="extraKeys.length > 0" class="schema-section">
      <div class="section-header" @click="toggleSection('__extra')">
        <span class="section-chevron" :class="{ collapsed: collapsedSections.has('__extra') }">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
        额外字段 ({{ extraKeys.length }})
      </div>
      <div v-show="!collapsedSections.has('__extra')" class="section-fields">
        <JsonFieldEditor :model-value="extraModelValue" :known-keys="extraKnownKeys" @update:model-value="onExtraUpdate" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { RowData } from '@/shared/types';
import type { SchemaRuntimeContext } from '@/domain/schema/schema-runtime';
import type { FileSchema, SectionSchema } from '@/domain/schema/schema.types';
import {
  getExtraFieldSource,
  getSchemaFieldKeys,
  getSchemaSections,
  isMultiSourceSchema,
  isSchemaInternalKey,
  schemaSectionCollapseIdentity,
} from '@/domain/schema/schema-sections';
import { getNestedValue, setNestedValue } from '@/domain/schema/schema-values';
import SchemaFieldRenderer from '@/app/components/schema/SchemaFieldRenderer.vue';
import JsonFieldEditor from '@/shared/ui/JsonFieldEditor.vue';

const props = defineProps<{
  schema: FileSchema;
  modelValue: RowData;
  runtimeContext?: SchemaRuntimeContext | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: RowData];
}>();

const sections = computed<SectionSchema[]>(() => getSchemaSections(props.schema));

const schemaKeys = computed<string[]>(() => getSchemaFieldKeys(props.schema));

const extraSource = computed(() => getExtraFieldSource(props.schema));

const extraModelValue = computed<RowData>(() => {
  if (!isMultiSourceSchema(props.schema)) return props.modelValue;
  const sourceId = extraSource.value;
  if (!sourceId) return {};
  const sourceValue = props.modelValue[sourceId];
  return sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) ? (sourceValue as RowData) : {};
});

const extraKnownKeys = computed<string[]>(() => {
  if (!isMultiSourceSchema(props.schema)) return schemaKeys.value;
  const sourceId = extraSource.value;
  if (!sourceId) return [];
  return schemaKeys.value.filter((key) => key.startsWith(`${sourceId}.`)).map((key) => key.slice(sourceId.length + 1));
});

const extraKeys = computed<string[]>(() =>
  Object.keys(extraModelValue.value).filter((key) => !isSchemaInternalKey(key) && !extraKnownKeys.value.includes(key)),
);

const collapsedSections = reactive(new Set<string>());

function syncCollapsedSections() {
  collapsedSections.clear();
  for (const section of sections.value) {
    if (section.collapsed) {
      collapsedSections.add(section.id);
    }
  }
}

watch(() => schemaSectionCollapseIdentity(props.schema), syncCollapsedSections, {
  immediate: true,
});

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

function onExtraUpdate(value: RowData) {
  if (!isMultiSourceSchema(props.schema)) {
    emit('update:modelValue', value);
    return;
  }
  const sourceId = extraSource.value;
  if (!sourceId) return;
  emit('update:modelValue', setNestedValue(props.modelValue, sourceId, value));
}
</script>
