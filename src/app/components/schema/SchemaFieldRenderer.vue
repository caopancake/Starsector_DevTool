<template>
  <div class="schema-field" :class="{ 'nested-row': isNested }">
    <span class="field-label" :title="fieldTitle">{{ field.label }}</span>
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
        <n-input
          v-else-if="field.type === 'string-array'"
          :value="formatSchemaCommaList(arrVal)"
          size="small"
          @update:value="emitPlainStringArray"
        />
        <n-input
          v-else-if="field.type === 'tag-select'"
          :value="formatSchemaCommaList(tagSelectVal)"
          size="small"
          @update:value="emitPlainTagSelect"
        />
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
          :render-label="renderSelectLabel"
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
          :render-label="renderSelectLabel"
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
          :render-label="renderSelectLabel"
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
              :render-label="renderSelectLabel"
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
            <n-input
              v-else
              :value="formatSchemaKeyValueText(entry.val)"
              class="kv-value-input"
              size="small"
              @update:value="updateKvVal(idx, $event)"
            />
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

        <!-- default JSON textarea -->
        <n-input v-else :value="jsonVal" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @update:value="emitParsed" />
      </template>

      <!-- Warning text -->
      <span v-if="field.warning" class="field-warning">{{ field.warning }}</span>
      <span v-if="field.danger" class="field-danger">{{ field.danger }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onUnmounted, ref, watch } from 'vue';
import { pickFileDialog } from '@/shared/runtime/dialog.runtime';
import type { JsonValue, SchemaRuntimeContext } from '@/shared/types';
import { normalizeRelPath, pathBelongsToRoot, relativePathFromRoot } from '@/shared/lib/paths';
import type { FieldSchema } from '@/domain/schema/schema.types';
import {
  appendSchemaKeyValueEntry,
  formatSchemaCommaList,
  formatSchemaKeyValueText,
  includeCurrentSelectOptions,
  parseSchemaCommaList,
  parseSchemaKeyValueText,
  parseSchemaPlainBoolean,
  parseSchemaPlainNumber,
  schemaArrayStringValues,
  schemaEnumSelectOptions,
  schemaKeyValueEntries,
  schemaKeyValueOutput,
  schemaPathDisplayLabel,
  schemaPlainBooleanText,
  schemaSourceCurrentValues,
  schemaSourceSelectOptions,
  schemaStringValue,
  schemaTagValues,
  selectOptionResourceRefs,
  type SchemaKeyValueEntry,
  selectOptionText,
  type SelectOption,
  wrapSchemaTagValues,
} from '@/domain/schema/schema-registry';
import ColorPicker from '@/shared/ui/ColorPicker.vue';
import { useCoreGraphics } from '@/app/composables/use-core-graphics';
import { useSettingsStore } from '@/stores/settings.store';
import { isCsvSource } from '@/domain/tables/csv-source-options';

const { graphicsPaths, loadGraphics } = useCoreGraphics();
loadGraphics();

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
const fieldTitle = computed(() => [props.field.key, props.field.description ?? ''].filter(Boolean).join('\n'));

// ─── Computed value converters ────────────────────────────────────────

const strVal = computed(() => schemaStringValue(props.value));
const stringTextareaAutosize = { minRows: 1, maxRows: 6 };
const stringInputType = computed(() => (strVal.value.includes('\n') || strVal.value.includes('\r') ? 'textarea' : 'text'));
const stringInputAutosize = computed(() => (stringInputType.value === 'textarea' ? stringTextareaAutosize : undefined));

const numVal = computed(() => (typeof props.value === 'number' ? props.value : parseFloat(String(props.value)) || 0));
const plainNumberText = computed(() => (props.value === null || props.value === undefined ? '' : String(props.value)));
const plainBooleanText = computed(() => schemaPlainBooleanText(props.value));

const boolVal = computed(() => props.value === true);

const arrVal = computed(() => schemaArrayStringValues(props.value));

const jsonVal = computed(() => {
  if (props.value == null) return '';
  try {
    return JSON.stringify(props.value, null, 2);
  } catch {
    return String(props.value);
  }
});

// tag-select: value is { tags: string[] } or string[]
const tagSelectVal = computed(() => schemaTagValues(props.value));

function wrapTags(tags: string[]): unknown {
  return wrapSchemaTagValues(props.value, tags);
}

function emitPlainNumber(raw: string, integer: boolean) {
  emit('update', parseSchemaPlainNumber(raw, integer));
}

function emitPlainBoolean(raw: string) {
  emit('update', parseSchemaPlainBoolean(raw));
}

function emitPlainStringArray(raw: string) {
  emit('update', parseSchemaCommaList(raw));
}

function emitPlainTagSelect(raw: string) {
  emit('update', wrapSchemaTagValues(props.value, parseSchemaCommaList(raw)));
}

// ─── Source / enum options ────────────────────────────────────────────

const loadedSourceOptions = ref<SelectOption[]>([]);
const sourceOptions = computed<SelectOption[]>(() => loadedSourceOptions.value);
const isReferenceKeyValue = computed(() => props.field.type === 'key-value' && isCsvSource(props.field.source));
const sourceCurrentValues = computed(() => schemaSourceCurrentValues(props.field, props.value));
const sourceCurrentValuesIdentity = computed(() => JSON.stringify(sourceCurrentValues.value));
const selectOpen = ref(false);
const suppressNextSelectOpen = ref(false);
const kvSelectOpen = ref<Record<number, boolean>>({});
const suppressNextKvSelectOpen = ref<Record<number, boolean>>({});
let sourceOptionsRequestId = 0;
let unsubscribeSourceOptionInvalidation: (() => void) | null = null;

// Render label with optional thumbnail for n-select options.
function renderSelectLabel(option: SelectOption & { label?: string; value?: string }) {
  const label = h('span', { class: 'schema-select-option-label' }, selectOptionText(option));
  if (!option.sprite) return h('span', { title: selectOptionTitle(option) }, [label]);
  return h('span', { class: 'schema-select-option', title: selectOptionTitle(option) }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    label,
  ]);
}

function selectOptionTitle(option: SelectOption & { label?: string; value?: string }): string | undefined {
  const value = option.value ?? '';
  const label = selectOptionText(option);
  return [value, label !== value ? label : '', option.description ?? ''].filter(Boolean).join('\n') || undefined;
}

const enumOptions = computed(() => {
  return schemaEnumSelectOptions(props.field, sourceOptions.value);
});

watch(
  () => [props.runtimeContext?.sessionId ?? null, props.field.source ?? null, sourceCurrentValuesIdentity.value] as const,
  () => {
    void reloadSourceOptions();
  },
  { immediate: true },
);

watch(
  () => [props.runtimeContext, props.field.source ?? ''] as const,
  ([runtimeContext, source]) => {
    unsubscribeSourceOptionInvalidation?.();
    unsubscribeSourceOptionInvalidation =
      runtimeContext?.subscribeSourceOptionInvalidation?.(source, loadedSourceOptionResourceRefs, () => {
        void reloadSourceOptions();
      }) ?? null;
  },
  { immediate: true },
);
onUnmounted(() => unsubscribeSourceOptionInvalidation?.());

async function reloadSourceOptions() {
  const requestId = ++sourceOptionsRequestId;
  const sessionId = props.runtimeContext?.sessionId ?? null;
  const source = props.field.source ?? null;
  if (!sessionId || !source || !isCsvSource(source)) {
    loadedSourceOptions.value = [];
    return;
  }
  const currentValues = sourceCurrentValues.value;
  const groups = await props.runtimeContext?.querySourceOptions?.(source, currentValues, undefined, 500);
  if (requestId !== sourceOptionsRequestId || sessionId !== props.runtimeContext?.sessionId || source !== props.field.source) return;
  if (!groups) {
    loadedSourceOptions.value = [];
    return;
  }
  loadedSourceOptions.value = schemaSourceSelectOptions(groups);
}

function loadedSourceOptionResourceRefs() {
  return selectOptionResourceRefs(loadedSourceOptions.value);
}

// ─── path-image graphics options ─────────────────────────────────────

const graphicsOptions = computed(() => {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  // Add core graphics paths
  for (const path of graphicsPaths.value) {
    if (!seen.has(path)) {
      seen.add(path);
      options.push({ label: schemaPathDisplayLabel(path), value: path });
    }
  }

  return options;
});

function renderGraphicsLabel(option: SelectOption & { label?: string; value?: string }) {
  const path = option.value ?? '';
  const filename = schemaPathDisplayLabel(path);
  return h('span', { title: path, class: 'schema-select-option-label' }, filename);
}

// For key-value fields: merge source options with existing keys as candidates
const kvKeyOptions = computed(() => {
  const source = sourceOptions.value;
  return includeCurrentSelectOptions(
    source,
    kvEntries.value.map((entry) => entry.key),
  );
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

const kvEntries = computed<SchemaKeyValueEntry[]>(() => schemaKeyValueEntries(props.value, props.field.format));

function emitKvUpdate(entries: SchemaKeyValueEntry[]) {
  emit('update', schemaKeyValueOutput(entries, props.field.format));
}

function updateKvKey(idx: number, newKey: string) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], key: newKey };
  emitKvUpdate(entries);
}

function updateKvVal(idx: number, newVal: string) {
  const entries = [...kvEntries.value];
  entries[idx] = { ...entries[idx], val: parseSchemaKeyValueText(newVal) };
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
  emit('update', appendSchemaKeyValueEntry(kvEntries.value, props.field.format));
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

// ─── File picker for path / path-image fields ────────────────────────

async function pickFile() {
  const modRoot = props.runtimeContext?.modRoot;
  if (!modRoot) return;

  const selected = await pickFileDialog({
    title: '选择文件',
    defaultPath: modRoot,
  });

  if (!selected || typeof selected !== 'string') return;

  if (pathBelongsToRoot(selected, modRoot)) {
    emit('update', relativePathFromRoot(modRoot, selected));
  } else {
    emit('update', normalizeRelPath(selected));
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
