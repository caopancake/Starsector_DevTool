<template>
  <div class="schema-field" :class="{ 'nested-row': isNested }">
    <span class="field-label" :title="field.description ?? undefined">{{ field.label }}</span>
    <div class="field-control">
      <template v-if="plainMode">
        <n-input
          v-if="field.type === 'string'"
          :value="strVal"
          type="textarea"
          :autosize="stringTextareaAutosize"
          size="small"
          :disabled="field.editable === false"
          @update:value="emitStringOrObject($event)"
        />
        <n-input
          v-else-if="field.type === 'text'"
          :value="strVal"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          size="small"
          @update:value="emit('update', $event)"
        />
        <n-input
          v-else-if="field.type === 'integer'"
          :value="plainNumberText"
          size="small"
          :disabled="field.editable === false"
          @update:value="emitPlainNumber($event, true)"
        />
        <n-input
          v-else-if="field.type === 'float'"
          :value="plainNumberText"
          size="small"
          :disabled="field.editable === false"
          @update:value="emitPlainNumber($event, false)"
        />
        <n-input
          v-else-if="field.type === 'boolean'"
          :value="plainBooleanText"
          size="small"
          :disabled="field.editable === false"
          @update:value="emitPlainBoolean"
        />
        <n-input
          v-else-if="field.type === 'enum'"
          :value="strVal"
          size="small"
          :disabled="field.editable === false"
          @update:value="emit('update', $event)"
        />
        <n-input
          v-else-if="field.type === 'color-rgb' || field.type === 'color-rgba'"
          :value="jsonVal"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          size="small"
          @update:value="emitParsed"
        />
        <n-input
          v-else-if="field.type === 'path-image' || field.type === 'path'"
          :value="strVal"
          size="small"
          @update:value="emit('update', $event)"
        />
        <n-input v-else-if="field.type === 'string-array'" :value="arrVal.join(', ')" size="small" @update:value="emitPlainStringArray" />
        <n-input v-else-if="field.type === 'tag-select'" :value="tagSelectVal.join(', ')" size="small" @update:value="emitPlainTagSelect" />
        <n-input
          v-else-if="field.type === 'key-value' || field.type === 'object' || field.type === 'array' || field.type === 'array-of-object'"
          :value="jsonVal"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 10 }"
          size="small"
          @update:value="emitParsed"
        />
        <n-input v-else :value="jsonVal" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @update:value="emitParsed" />
      </template>

      <template v-else>
        <!-- string -->
        <n-input
          v-if="field.type === 'string'"
          :value="strVal"
          :type="stringInputType"
          :autosize="stringInputAutosize"
          size="small"
          :disabled="field.editable === false"
          @update:value="emitStringOrObject($event)"
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
        <n-switch
          v-else-if="field.type === 'boolean'"
          class="tool-switch field-switch"
          :value="boolVal"
          size="small"
          @update:value="emit('update', $event)"
        />

        <!-- enum -->
        <n-select
          v-else-if="field.type === 'enum'"
          :show="selectOpen"
          :value="strVal"
          :options="enumOptions"
          :render-label="hasSprites ? renderSelectLabel : undefined"
          size="small"
          clearable
          @mousedown.capture="closeOpenSelectOnFieldClick"
          @update:show="handleSelectShowUpdate"
          @update:value="emit('update', $event)"
        />

        <!-- color-rgba -->
        <ColorPicker
          v-else-if="field.type === 'color-rgb' || field.type === 'color-rgba'"
          :model-value="props.value as JsonValue"
          :channels="field.type === 'color-rgb' ? 'rgb' : 'rgba'"
          :output="field.type === 'color-rgb' ? 'rgb-array' : 'rgba-array'"
          @update:model-value="emit('update', $event)"
        />

        <!-- path-image: searchable dropdown + file picker -->
        <div v-else-if="field.type === 'path-image'" class="path-field">
          <n-select
            :show="selectOpen"
            :value="strVal || null"
            :options="graphicsOptions"
            :render-label="renderGraphicsLabel"
            filterable
            clearable
            tag
            size="small"
            placeholder="搜索或输入图片路径"
            class="path-select"
            @mousedown.capture="closeOpenSelectOnFieldClick"
            @update:show="handleSelectShowUpdate"
            @update:value="emit('update', $event ?? '')"
          />
          <n-button class="compact-icon-button" size="small" quaternary title="选择文件" @click="pickFile">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19V5h6l2 2h8v12H4z" />
              <path d="M8 14h8M12 10v8" />
            </svg>
          </n-button>
        </div>

        <!-- path: input + file picker (no image dropdown) -->
        <div v-else-if="field.type === 'path'" class="path-field">
          <n-input :value="strVal" size="small" @update:value="emit('update', $event)" />
          <n-button class="compact-icon-button" size="small" quaternary title="选择文件" @click="pickFile">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19V5h6l2 2h8v12H4z" />
              <path d="M8 14h8M12 10v8" />
            </svg>
          </n-button>
        </div>

        <!-- string-array -->
        <n-select
          v-else-if="field.type === 'string-array'"
          :show="selectOpen"
          :value="arrVal"
          :options="sourceOptions.length > 0 ? sourceOptions : arrVal.map((v) => ({ label: v, value: v }))"
          :render-label="hasSprites ? renderSelectLabel : undefined"
          multiple
          filterable
          tag
          size="small"
          @mousedown.capture="closeOpenSelectOnFieldClick"
          @update:show="handleSelectShowUpdate"
          @update:value="emit('update', $event)"
        />

        <!-- tag-select -->
        <n-select
          v-else-if="field.type === 'tag-select'"
          :show="selectOpen"
          :value="tagSelectVal"
          :options="sourceOptions"
          :render-label="hasSprites ? renderSelectLabel : undefined"
          multiple
          filterable
          tag
          size="small"
          @mousedown.capture="closeOpenSelectOnFieldClick"
          @update:show="handleSelectShowUpdate"
          @update:value="emit('update', wrapTags($event))"
        />

        <!-- key-value -->
        <div v-else-if="field.type === 'key-value'" class="key-value-editor" :class="{ 'reference-key-value': isReferenceKeyValue }">
          <div v-for="(entry, idx) in kvEntries" :key="idx" class="kv-row">
            <n-select
              :show="kvSelectOpen[idx]"
              :value="entry.key"
              :options="kvKeyOptions"
              :render-label="optionsContainSprites(kvKeyOptions) ? renderSelectLabel : undefined"
              filterable
              tag
              size="small"
              class="kv-key-select"
              @mousedown.capture="closeOpenKvSelectOnFieldClick($event, idx)"
              @update:show="handleKvSelectShowUpdate(idx, $event)"
              @update:value="updateKvKey(idx, $event)"
            />
            <SchemaFieldRenderer
              v-if="field.valueSchema"
              :field="field.valueSchema"
              :value="entry.val"
              :runtime-context="runtimeContext"
              :is-nested="true"
              @update="updateKvValue(idx, $event)"
            />
            <n-input v-else :value="formatKvVal(entry.val)" class="kv-value-input" size="small" @update:value="updateKvVal(idx, $event)" />
            <n-button class="compact-icon-button" size="tiny" quaternary title="删除" @click="removeKvEntry(idx)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </n-button>
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
            :runtime-context="runtimeContext"
            :is-nested="true"
            @update="onSubUpdate(sub.key, $event)"
          />
        </div>

        <!-- array -->
        <div v-else-if="field.type === 'array' && field.item" class="array-of-object">
          <div v-for="(_item, idx) in genericArrayItems" :key="idx" class="array-item">
            <div class="array-item-header">
              <span class="array-item-index">#{{ idx + 1 }}</span>
              <n-button class="compact-icon-button" size="tiny" quaternary title="删除" @click="removeGenericArrayItem(idx)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </n-button>
            </div>
            <SchemaFieldRenderer
              :field="field.item"
              :value="genericArrayItems[idx]"
              :runtime-context="runtimeContext"
              :is-nested="true"
              @update="updateGenericArrayItem(idx, $event)"
            />
          </div>
          <n-button size="tiny" @click="addGenericArrayItem">+ 添加项</n-button>
        </div>

        <!-- array-of-object -->
        <div v-else-if="field.type === 'array-of-object' && field.nested" class="array-of-object">
          <div v-for="(item, idx) in arrayItems" :key="idx" class="array-item">
            <div class="array-item-header">
              <span class="array-item-index">#{{ idx + 1 }}</span>
              <n-button class="compact-icon-button" size="tiny" quaternary title="删除" @click="removeArrayItem(idx)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </n-button>
            </div>
            <SchemaFieldRenderer
              v-for="sub in field.nested"
              :key="sub.key"
              :field="sub"
              :value="getArrayItemValue(idx, sub.key)"
              :runtime-context="runtimeContext"
              :is-nested="true"
              @update="onArrayItemUpdate(idx, sub.key, $event)"
            />
          </div>
          <n-button size="tiny" @click="addArrayItem">+ 添加项</n-button>
        </div>

        <!-- fallback: JSON textarea -->
        <n-input v-else :value="jsonVal" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @update:value="emitParsed" />
      </template>

      <!-- Warning text -->
      <span v-if="field.warning" class="field-warning">{{ field.warning }}</span>
      <span v-if="field.danger" class="field-danger">{{ field.danger }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { pickFileDialog } from '@/shared/runtime/dialog.runtime';
import type { JsonValue, SchemaRuntimeContext } from '@/shared/types';
import type { FieldSchema } from '@/domain/schema/schema.types';
import type { SelectOption } from '@/domain/schema/schema-registry';
import ColorPicker from '@/shared/ui/ColorPicker.vue';
import { useCoreGraphics } from '@/app/composables/use-core-graphics';
import { useSettingsStore } from '@/stores/settings.store';
import { queryTableSourceOptions } from '@/services/csv-table.service';

const { graphicsPaths, loadGraphics } = useCoreGraphics();
loadGraphics(); // Fire-and-forget, loads once and caches

const props = defineProps<{
  field: FieldSchema;
  value: unknown;
  runtimeContext?: SchemaRuntimeContext | null;
  isNested?: boolean;
}>();

const emit = defineEmits<{
  update: [value: unknown];
}>();

const settings = useSettingsStore();
const plainMode = computed(() => settings.isPlainEditMode);

// ─── Computed value converters ────────────────────────────────────────

const strVal = computed(() => {
  if (props.value == null) return '';
  if (typeof props.value === 'object') return JSON.stringify(props.value);
  return String(props.value);
});
const stringTextareaAutosize = { minRows: 1, maxRows: 6 };
const stringInputType = computed(() => (strVal.value.includes('\n') || strVal.value.includes('\r') ? 'textarea' : 'text'));
const stringInputAutosize = computed(() => (stringInputType.value === 'textarea' ? stringTextareaAutosize : undefined));

const numVal = computed(() => (typeof props.value === 'number' ? props.value : parseFloat(String(props.value)) || 0));
const plainNumberText = computed(() => (props.value === null || props.value === undefined ? '' : String(props.value)));
const plainBooleanText = computed(() => {
  if (props.value === true) return 'true';
  if (props.value === false) return 'false';
  return strVal.value;
});

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

function emitPlainNumber(raw: string, integer: boolean) {
  const trimmed = raw.trim();
  if (trimmed === '') {
    emit('update', '');
    return;
  }
  const parsed = integer ? parseInt(trimmed, 10) : Number(trimmed);
  if (Number.isFinite(parsed)) {
    emit('update', parsed);
    return;
  }
  emit('update', raw);
}

function emitPlainBoolean(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    emit('update', true);
    return;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    emit('update', false);
    return;
  }
  emit('update', raw);
}

function emitPlainStringArray(raw: string) {
  emit(
    'update',
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function emitPlainTagSelect(raw: string) {
  const tags = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const v = props.value;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'tags' in (v as Record<string, unknown>)) {
    emit('update', { ...(v as Record<string, unknown>), tags });
    return;
  }
  emit('update', tags);
}

// ─── Source / enum options ────────────────────────────────────────────

const loadedSourceOptions = ref<SelectOption[]>([]);
const sourceOptions = computed<SelectOption[]>(() => loadedSourceOptions.value);
const isReferenceKeyValue = computed(() => props.field.type === 'key-value' && props.field.source?.startsWith('csv:'));
const selectOpen = ref(false);
const suppressNextSelectOpen = ref(false);
const kvSelectOpen = ref<Record<number, boolean>>({});
const suppressNextKvSelectOpen = ref<Record<number, boolean>>({});

// Check if any source option has a sprite — enables thumbnail rendering
const hasSprites = computed(() => optionsContainSprites(sourceOptions.value));

// Render label with optional thumbnail for n-select options
function renderSelectLabel(option: SelectOption & { label?: string; value?: string }) {
  if (!option.sprite) return option.label ?? option.value ?? '';
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, option.label ?? option.value ?? ''),
  ]);
}

function optionsContainSprites(options: SelectOption[]): boolean {
  return options.some((option) => Boolean(option.sprite) || Boolean(option.children?.some((child) => child.sprite)));
}

const enumOptions = computed(() => {
  if (props.field.options && props.field.options.length > 0) {
    return props.field.options.map((o) => ({ label: o, value: o }));
  }
  return sourceOptions.value;
});

watch(
  () =>
    [
      props.runtimeContext?.sessionId ?? '',
      props.field.source ?? '',
      strVal.value,
      arrVal.value.join(','),
      tagSelectVal.value.join(','),
    ] as const,
  async ([sessionId, source]) => {
    if (!sessionId || !source?.startsWith('csv:')) {
      loadedSourceOptions.value = [];
      return;
    }
    const currentValues = currentSourceValues();
    const groups = await queryTableSourceOptions(sessionId, source, currentValues, undefined, 500);
    loadedSourceOptions.value = groups.map((group) => ({
      type: 'group',
      label: group.label,
      value: group.label,
      children: group.options.map((option) => ({
        label: option.label,
        value: option.value,
        sprite: option.sprite ?? undefined,
        resourceRef: option.resourceRef ?? null,
      })),
    }));
  },
  { immediate: true },
);

function currentSourceValues(): string[] {
  if (props.field.type === 'string-array') return arrVal.value;
  if (props.field.type === 'tag-select') return tagSelectVal.value;
  if (props.field.type === 'key-value' && props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
    return Object.keys(props.value as Record<string, unknown>);
  }
  return strVal.value ? [strVal.value] : [];
}

// ─── path-image graphics options ─────────────────────────────────────

const graphicsOptions = computed(() => {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  // Add core graphics paths
  for (const path of graphicsPaths.value) {
    if (!seen.has(path)) {
      seen.add(path);
      options.push({ label: path.split('/').pop() ?? path, value: path });
    }
  }

  return options;
});

function renderGraphicsLabel(option: SelectOption & { label?: string; value?: string }) {
  const path = option.value ?? '';
  const filename = path.split('/').pop() ?? path;
  return h('span', { title: path, class: 'schema-select-option-label' }, filename);
}

// For key-value fields: merge source options with existing keys as candidates
const kvKeyOptions = computed(() => {
  const source = sourceOptions.value;
  const existing: SelectOption[] = [];
  for (const entry of kvEntries.value) {
    if (entry.key && !optionValueExists(source, entry.key) && !existing.some((option) => option.value === entry.key)) {
      existing.push({ label: entry.key, value: entry.key });
    }
  }
  if (existing.length === 0) return source;
  return [{ type: 'group' as const, label: '当前值', value: '__existing', children: existing }, ...source];
});

function optionValueExists(options: SelectOption[], value: string): boolean {
  return options.some((option) => option.value === value || Boolean(option.children?.some((child) => child.value === value)));
}

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
  if (props.field.format === 'array-of-entries' && Array.isArray(props.value)) {
    return (props.value as Record<string, unknown>[]).map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const keys = Object.keys(item);
        if (keys.length > 0) {
          return { key: keys[0], val: item[keys[0]] };
        }
      }
      return { key: '', val: '' };
    });
  }
  if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
    return Object.entries(props.value as Record<string, unknown>).map(([key, val]) => ({ key, val }));
  }
  return [];
});

function rebuildKvObject(entries: KvEntry[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.key) {
      if (typeof e.val === 'object' && e.val !== null) {
        result[e.key] = e.val;
      } else {
        const str = String(e.val);
        const num = Number(str);
        result[e.key] = !isNaN(num) && str.trim() !== '' ? num : e.val;
      }
    }
  }
  return result;
}

function rebuildKvArray(entries: KvEntry[]): Record<string, unknown>[] {
  return entries.filter((e) => e.key).map((e) => ({ [e.key]: e.val }));
}

function emitKvUpdate(entries: KvEntry[]) {
  if (props.field.format === 'array-of-entries') {
    emit('update', rebuildKvArray(entries));
  } else {
    emit('update', rebuildKvObject(entries));
  }
}

function updateKvKey(idx: number, newKey: string) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], key: newKey };
  emitKvUpdate(entries);
}

function updateKvVal(idx: number, newVal: string) {
  const entries = [...kvEntries.value];
  let parsed: unknown = newVal;
  const trimmed = newVal.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Keep as string
    }
  }
  entries[idx] = { ...entries[idx], val: parsed };
  emitKvUpdate(entries);
}

function updateKvValue(idx: number, newVal: unknown) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], val: newVal };
  emitKvUpdate(entries);
}

function removeKvEntry(idx: number) {
  const entries = [...kvEntries.value];
  entries.splice(idx, 1);
  const nextOpen: Record<number, boolean> = {};
  for (const [key, value] of Object.entries(kvSelectOpen.value)) {
    const keyIndex = Number(key);
    if (keyIndex < idx) nextOpen[keyIndex] = value;
    if (keyIndex > idx) nextOpen[keyIndex - 1] = value;
  }
  kvSelectOpen.value = nextOpen;
  emitKvUpdate(entries);
}

function addKvEntry() {
  if (props.field.format === 'array-of-entries') {
    const current = Array.isArray(props.value) ? (props.value as Record<string, unknown>[]) : [];
    let newKey = 'WS 000';
    let i = 1;
    const existingKeys = new Set(kvEntries.value.map((e) => e.key));
    while (existingKeys.has(newKey)) {
      newKey = `WS ${String(i++).padStart(3, '0')}`;
    }
    emit('update', [...current, { [newKey]: '' }]);
  } else {
    const current =
      props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? (props.value as Record<string, unknown>) : {};
    let newKey = 'newField';
    let i = 1;
    while (newKey in current) {
      newKey = `newField${i++}`;
    }
    emit('update', { ...current, [newKey]: '' });
  }
}

// ─── Generic array helpers ────────────────────────────────────────────

const genericArrayItems = computed(() => (Array.isArray(props.value) ? props.value : []));

function updateGenericArrayItem(idx: number, itemValue: unknown) {
  const items = [...genericArrayItems.value];
  items[idx] = itemValue;
  emit('update', items);
}

function addGenericArrayItem() {
  const items = [...genericArrayItems.value];
  items.push(props.field.item?.default ?? null);
  emit('update', items);
}

function removeGenericArrayItem(idx: number) {
  const items = [...genericArrayItems.value];
  items.splice(idx, 1);
  emit('update', items);
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

// ─── String-or-object smart emitter (for version-like fields) ────────

function emitStringOrObject(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      emit('update', JSON.parse(trimmed));
      return;
    } catch {
      // Not valid JSON, emit as string
    }
  }
  emit('update', raw);
}

// ─── Key-value value formatter (handles nested objects) ──────────────

function formatKvVal(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ─── File picker for path / path-image fields ────────────────────────

async function pickFile() {
  const modRoot = props.runtimeContext?.modRoot;
  if (!modRoot) return;

  const selected = await pickFileDialog({
    title: '选择文件',
    defaultPath: modRoot,
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

function closeOpenSelectOnFieldClick(event: MouseEvent) {
  if (!selectOpen.value || shouldLetSelectClickPass(event)) return;
  event.preventDefault();
  event.stopPropagation();
  suppressNextSelectOpen.value = true;
  selectOpen.value = false;
  window.setTimeout(() => {
    suppressNextSelectOpen.value = false;
  });
}

function closeOpenKvSelectOnFieldClick(event: MouseEvent, idx: number) {
  if (!kvSelectOpen.value[idx] || shouldLetSelectClickPass(event)) return;
  event.preventDefault();
  event.stopPropagation();
  suppressNextKvSelectOpen.value = { ...suppressNextKvSelectOpen.value, [idx]: true };
  kvSelectOpen.value[idx] = false;
  window.setTimeout(() => {
    suppressNextKvSelectOpen.value = { ...suppressNextKvSelectOpen.value, [idx]: false };
  });
}

function handleSelectShowUpdate(show: boolean) {
  if (show && suppressNextSelectOpen.value) return;
  selectOpen.value = show;
}

function handleKvSelectShowUpdate(idx: number, show: boolean) {
  if (show && suppressNextKvSelectOpen.value[idx]) return;
  kvSelectOpen.value[idx] = show;
}

function shouldLetSelectClickPass(event: MouseEvent): boolean {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (!target?.closest) return false;
  return Boolean(target.closest('.n-base-selection-tag__close, .n-tag__close, .n-base-close, .n-base-selection__clear'));
}
</script>
