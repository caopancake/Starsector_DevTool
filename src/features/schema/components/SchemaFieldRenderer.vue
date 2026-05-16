<template>
  <div class="settings-row" :class="{ 'nested-row': isNested }">
    <span class="field-label" :title="field.description ?? undefined">{{ field.label }}</span>
    <div class="field-control">
      <!-- string -->
      <n-input
        v-if="field.type === 'string'"
        :value="strVal"
        size="small"
        :disabled="field.editable === false"
        @update:value="emit('update', $event)"
      />

      <!-- text (textarea) -->
      <n-input
        v-else-if="field.type === 'text'"
        :value="strVal"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 6 }"
        size="small"
        @update:value="emit('update', $event)"
      />

      <!-- integer -->
      <n-input-number
        v-else-if="field.type === 'integer'"
        :value="numVal"
        :min="field.min ?? undefined"
        :max="field.max ?? undefined"
        :step="field.step ?? 1"
        :show-button="false"
        size="small"
        @update:value="emit('update', $event ?? 0)"
      />

      <!-- float -->
      <n-input-number
        v-else-if="field.type === 'float'"
        :value="numVal"
        :min="field.min ?? undefined"
        :max="field.max ?? undefined"
        :step="field.step ?? 0.1"
        :show-button="false"
        size="small"
        @update:value="emit('update', $event ?? 0)"
      />

      <!-- boolean -->
      <n-switch v-else-if="field.type === 'boolean'" :value="boolVal" size="small" @update:value="emit('update', $event)" />

      <!-- enum -->
      <n-select
        v-else-if="field.type === 'enum'"
        :value="strVal"
        :options="enumOptions"
        size="small"
        clearable
        @update:value="emit('update', $event)"
      />

      <!-- color-rgb -->
      <ColorArrayInput
        v-else-if="field.type === 'color-rgb'"
        :model-value="props.value as JsonValue"
        @update:model-value="emit('update', $event)"
      />

      <!-- path-image / path -->
      <n-input
        v-else-if="field.type === 'path-image' || field.type === 'path'"
        :value="strVal"
        size="small"
        @update:value="emit('update', $event)"
      />

      <!-- string-array -->
      <n-dynamic-tags v-else-if="field.type === 'string-array'" :value="arrVal" size="small" @update:value="emit('update', $event)" />

      <!-- tag-select -->
      <n-select
        v-else-if="field.type === 'tag-select'"
        :value="tagSelectVal"
        :options="sourceOptions"
        multiple
        filterable
        tag
        size="small"
        @update:value="emit('update', wrapTags($event))"
      />

      <!-- key-value -->
      <div v-else-if="field.type === 'key-value'" class="key-value-editor">
        <div v-for="(entry, idx) in kvEntries" :key="idx" class="kv-row">
          <n-select
            v-if="sourceOptions.length > 0"
            :value="entry.key"
            :options="sourceOptions"
            filterable
            tag
            size="small"
            style="width: 180px"
            @update:value="updateKvKey(idx, $event)"
          />
          <n-input v-else :value="entry.key" size="small" style="width: 180px" @update:value="updateKvKey(idx, $event)" />
          <n-input :value="String(entry.val)" size="small" style="width: 100px" @update:value="updateKvVal(idx, $event)" />
          <n-button size="tiny" quaternary @click="removeKvEntry(idx)">✕</n-button>
        </div>
        <n-button size="tiny" @click="addKvEntry">+ 添加</n-button>
      </div>

      <!-- object (recurse into nested fields) -->
      <div v-else-if="field.type === 'object' && field.nested" class="nested-object">
        <SchemaFieldRenderer
          v-for="sub in field.nested"
          :key="sub.key"
          :field="sub"
          :value="getSubValue(sub.key)"
          :app-data="appData"
          :is-nested="true"
          @update="onSubUpdate(sub.key, $event)"
        />
      </div>

      <!-- array-of-object -->
      <div v-else-if="field.type === 'array-of-object' && field.nested" class="array-of-object">
        <div v-for="(item, idx) in arrayItems" :key="idx" class="array-item">
          <div class="array-item-header">
            <span class="array-item-index">#{{ idx + 1 }}</span>
            <n-button size="tiny" quaternary @click="removeArrayItem(idx)">✕</n-button>
          </div>
          <SchemaFieldRenderer
            v-for="sub in field.nested"
            :key="sub.key"
            :field="sub"
            :value="getArrayItemValue(idx, sub.key)"
            :app-data="appData"
            :is-nested="true"
            @update="onArrayItemUpdate(idx, sub.key, $event)"
          />
        </div>
        <n-button size="tiny" @click="addArrayItem">+ 添加项</n-button>
      </div>

      <!-- fallback: JSON textarea -->
      <n-input v-else :value="jsonVal" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @update:value="emitParsed" />

      <!-- Warning text -->
      <span v-if="field.warning" class="field-warning">{{ field.warning }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AppData, JsonValue } from '../../../shared/types';
import type { FieldSchema } from '../schema.types';
import { resolveSource } from '../schema.service';
import ColorArrayInput from '../../config/components/ColorArrayInput.vue';

const props = defineProps<{
  field: FieldSchema;
  value: unknown;
  appData: AppData | null;
  isNested?: boolean;
}>();

const emit = defineEmits<{
  update: [value: unknown];
}>();

// ─── Computed value converters ────────────────────────────────────────

const strVal = computed(() => (props.value == null ? '' : String(props.value)));

const numVal = computed(() => (typeof props.value === 'number' ? props.value : parseFloat(String(props.value)) || 0));

const boolVal = computed(() => props.value === true);

const arrVal = computed(() => (Array.isArray(props.value) ? props.value.map(String) : []));

const jsonVal = computed(() => {
  if (props.value == null) return '';
  try {
    return JSON.stringify(props.value, null, 2);
  } catch {
    return String(props.value);
  }
});

// tag-select: value is { tags: string[] } or string[]
const tagSelectVal = computed(() => {
  const v = props.value;
  if (Array.isArray(v)) return v.map(String);
  if (v && typeof v === 'object' && 'tags' in (v as Record<string, unknown>)) {
    const tags = (v as Record<string, unknown>).tags;
    return Array.isArray(tags) ? tags.map(String) : [];
  }
  return [];
});

function wrapTags(tags: string[]): unknown {
  // If original value was an object with tags, wrap back
  const v = props.value;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'tags' in (v as Record<string, unknown>)) {
    return { ...(v as Record<string, unknown>), tags };
  }
  return tags;
}

// ─── Source / enum options ────────────────────────────────────────────

const sourceOptions = computed(() => resolveSource(props.field.source, props.appData));

const enumOptions = computed(() => {
  if (props.field.options && props.field.options.length > 0) {
    return props.field.options.map((o) => ({ label: o, value: o }));
  }
  return sourceOptions.value;
});

// ─── Nested object helpers ────────────────────────────────────────────

function getSubValue(subKey: string): unknown {
  if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
    return (props.value as Record<string, unknown>)[subKey];
  }
  return undefined;
}

function onSubUpdate(subKey: string, subValue: unknown) {
  const current =
    props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? (props.value as Record<string, unknown>) : {};
  emit('update', { ...current, [subKey]: subValue });
}

// ─── Array-of-object helpers ──────────────────────────────────────────

const arrayItems = computed(() => (Array.isArray(props.value) ? (props.value as Record<string, unknown>[]) : []));

function getArrayItemValue(idx: number, subKey: string): unknown {
  const item = arrayItems.value[idx];
  return item ? item[subKey] : undefined;
}

function onArrayItemUpdate(idx: number, subKey: string, subValue: unknown) {
  const items = [...arrayItems.value];
  items[idx] = { ...items[idx], [subKey]: subValue };
  emit('update', items);
}

function addArrayItem() {
  const items = [...arrayItems.value];
  const newItem: Record<string, unknown> = {};
  if (props.field.nested) {
    for (const sub of props.field.nested) {
      newItem[sub.key] = sub.default ?? null;
    }
  }
  items.push(newItem);
  emit('update', items);
}

function removeArrayItem(idx: number) {
  const items = [...arrayItems.value];
  items.splice(idx, 1);
  emit('update', items);
}

// ─── Key-value helpers ────────────────────────────────────────────────

interface KvEntry {
  key: string;
  val: unknown;
}

const kvEntries = computed<KvEntry[]>(() => {
  if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
    return Object.entries(props.value as Record<string, unknown>).map(([key, val]) => ({ key, val }));
  }
  return [];
});

function rebuildKvObject(entries: KvEntry[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.key) {
      // Try to parse numeric values
      const num = Number(e.val);
      result[e.key] = !isNaN(num) && String(e.val).trim() !== '' ? num : e.val;
    }
  }
  return result;
}

function updateKvKey(idx: number, newKey: string) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], key: newKey };
  emit('update', rebuildKvObject(entries));
}

function updateKvVal(idx: number, newVal: string) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], val: newVal };
  emit('update', rebuildKvObject(entries));
}

function removeKvEntry(idx: number) {
  const entries = [...kvEntries.value];
  entries.splice(idx, 1);
  emit('update', rebuildKvObject(entries));
}

function addKvEntry() {
  const entries = [...kvEntries.value];
  entries.push({ key: '', val: '' });
  emit('update', rebuildKvObject(entries));
}

// ─── Fallback JSON parser ─────────────────────────────────────────────

function emitParsed(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    emit('update', parsed);
  } catch {
    emit('update', raw);
  }
}
</script>

<style scoped>
.settings-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 0;
}

.settings-row.nested-row {
  padding-left: 16px;
}

.field-label {
  min-width: 140px;
  max-width: 180px;
  font-size: 13px;
  color: var(--color-text-secondary, #999);
  padding-top: 4px;
  flex-shrink: 0;
}

.field-control {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-warning {
  font-size: 11px;
  color: var(--color-warning, #e8a838);
}

.nested-object {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-left: 2px solid var(--color-border, #333);
  border-radius: 2px;
  min-width: 0;
  overflow: hidden;
}

.array-of-object {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.array-item {
  padding: 8px;
  border: 1px solid var(--color-border, #333);
  border-radius: 4px;
  min-width: 0;
  overflow: hidden;
}

.array-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.array-item-index {
  font-size: 11px;
  color: var(--color-text-secondary, #666);
  font-weight: 600;
}

.key-value-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
</style>
