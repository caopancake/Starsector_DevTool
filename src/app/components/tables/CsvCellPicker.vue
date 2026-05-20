<template>
  <div class="csv-cell-picker" :style="pickerStyle" tabindex="-1" @mousedown.stop @keydown.esc.prevent="$emit('close')">
    <input ref="searchRef" v-model="query" class="csv-cell-picker-search" placeholder="搜索" />
    <div class="csv-cell-picker-list">
      <template v-for="group in filteredGroups" :key="group.key">
        <div v-if="group.label" class="csv-cell-picker-group">{{ group.label }}</div>
        <button
          v-for="option in group.options"
          :key="option.value"
          :class="['csv-cell-picker-option', { selected: selectedValues.has(option.value) }]"
          type="button"
          @click="selectOption(option.value)"
        >
          <span v-if="multiple" class="csv-cell-picker-check">{{ selectedValues.has(option.value) ? '✓' : '' }}</span>
          <img v-if="option.sprite" class="csv-cell-picker-thumb" :src="option.sprite" :alt="option.label" />
          <span class="csv-cell-picker-label">{{ option.label }}</span>
          <span v-if="option.value !== option.label" class="csv-cell-picker-value">{{ option.value }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import type { SelectOption } from '@/domain/schema/schema-registry';

interface FlatOption {
  label: string;
  sprite?: string;
  value: string;
}

interface OptionGroup {
  key: string;
  label: string;
  options: FlatOption[];
}

const props = defineProps<{
  anchor: { height: number; left: number; top: number; width: number };
  multiple: boolean;
  options: SelectOption[];
  values: string[];
}>();

const emit = defineEmits<{
  close: [];
  update: [values: string[]];
}>();

const query = ref('');
const searchRef = ref<HTMLInputElement | null>(null);
const selectedValues = computed(() => new Set(props.values));
const pickerStyle = computed(() => ({
  left: `${props.anchor.left}px`,
  minWidth: `${Math.max(props.anchor.width, 180)}px`,
  top: `${props.anchor.top + props.anchor.height + 2}px`,
  width: `${Math.min(Math.max(props.anchor.width, 260), 460)}px`,
}));
const groups = computed<OptionGroup[]>(() => flattenOptions(props.options));
const filteredGroups = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return groups.value;
  return groups.value
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.options.length > 0);
});

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown, true);
  nextTick(() => searchRef.value?.focus());
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown, true);
});

function selectOption(value: string) {
  if (!props.multiple) {
    emit('update', [value]);
    emit('close');
    return;
  }
  const next = new Set(props.values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  emit('update', [...next]);
}

function flattenOptions(options: SelectOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const ungrouped: FlatOption[] = [];
  for (const option of options) {
    if (option.type === 'group') {
      groups.push({
        key: option.value,
        label: option.label,
        options: (option.children ?? []).map(toFlatOption),
      });
    } else {
      ungrouped.push(toFlatOption(option));
    }
  }
  if (ungrouped.length > 0) groups.unshift({ key: '__ungrouped', label: '', options: ungrouped });
  return groups;
}

function toFlatOption(option: SelectOption): FlatOption {
  return {
    label: option.label,
    sprite: option.sprite,
    value: option.value,
  };
}

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (target?.closest?.('.csv-cell-picker')) return;
  emit('close');
}
</script>
