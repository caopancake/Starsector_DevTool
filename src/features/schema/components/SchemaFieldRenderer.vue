<template>
  <div class="schema-field" :class="{ 'nested-row': isNested }">
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
      <div v-else-if="field.type === 'path-image' || field.type === 'path'" class="path-field">
        <n-input :value="strVal" size="small" @update:value="emit('update', $event)" />
        <n-button size="small" quaternary title="选择文件" @click="pickFile">
          <template #icon><span class="pick-icon">📂</span></template>
        </n-button>
      </div>

      <!-- string-array -->
      <n-select
        v-else-if="field.type === 'string-array'"
        :value="arrVal"
        :options="sourceOptions.length > 0 ? sourceOptions : arrVal.map((v) => ({ label: v, value: v }))"
        multiple
        filterable
        tag
        size="small"
        @update:value="emit('update', $event)"
      />

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
            :value="entry.key"
            :options="kvKeyOptions"
            filterable
            tag
            size="small"
            style="width: 180px"
            @update:value="updateKvKey(idx, $event)"
          />
          <n-input :value="String(entry.val)" size="small" style="flex: 1" @update:value="updateKvVal(idx, $event)" />
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
import { open } from '@tauri-apps/plugin-dialog';
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

// For key-value fields: merge source options with existing keys as candidates
const kvKeyOptions = computed(() => {
  const opts = new Map<string, { label: string; value: string }>();
  // Add source options first
  for (const opt of sourceOptions.value) {
    opts.set(opt.value, opt);
  }
  // Add existing keys that aren't already in source
  for (const entry of kvEntries.value) {
    if (entry.key && !opts.has(entry.key)) {
      opts.set(entry.key, { label: entry.key, value: entry.key });
    }
  }
  return [...opts.values()];
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
  // Directly add to the object with a placeholder key that won't collide
  const current =
    props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? (props.value as Record<string, unknown>) : {};
  // Find a unique new key name
  let newKey = 'newField';
  let i = 1;
  while (newKey in current) {
    newKey = `newField${i++}`;
  }
  emit('update', { ...current, [newKey]: '' });
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

// ─── File picker for path / path-image fields ────────────────────────

async function pickFile() {
  const modRoot = props.appData?.modRoot;
  if (!modRoot) return;

  const selected = await open({
    title: '选择文件',
    defaultPath: modRoot,
    multiple: false,
  });

  if (!selected || typeof selected !== 'string') return;

  // Calculate relative path from mod root
  const normalized = selected.replace(/\\/g, '/');
  const normalizedRoot = modRoot.replace(/\\/g, '/').replace(/\/$/, '');

  if (normalized.startsWith(normalizedRoot + '/')) {
    // File is inside mod directory — use relative path
    emit('update', normalized.slice(normalizedRoot.length + 1));
  } else {
    // File is outside mod directory — use as-is (absolute or relative to game root)
    emit('update', normalized);
  }
}
</script>

<style scoped>
.schema-field {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 4px 8px;
  align-items: start;
  padding: 3px 0;
  min-width: 0;
}

.schema-field.nested-row {
  padding-left: 12px;
}

.field-label {
  font-size: 11px;
  color: var(--color-muted);
  padding-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}

.field-control {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-warning {
  font-size: 10px;
  color: var(--color-warning);
}

.nested-object {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 0 4px 8px;
  border-left: 2px solid var(--color-border);
  min-width: 0;
  overflow: hidden;
}

.array-of-object {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.array-item {
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  min-width: 0;
  overflow: hidden;
  background: var(--color-surface);
}

.array-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.array-item-index {
  font-size: 10px;
  color: var(--color-muted);
  font-weight: 600;
}

.key-value-editor {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.path-field {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.path-field .n-input {
  flex: 1;
}

.pick-icon {
  font-size: 12px;
  line-height: 1;
}
</style>
