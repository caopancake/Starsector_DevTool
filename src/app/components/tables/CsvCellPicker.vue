<template>
  <div class="csv-cell-picker" :style="pickerStyle" tabindex="-1" @mousedown.stop @keydown.esc.prevent="$emit('close')">
    <input
      ref="searchRef"
      v-model="query"
      class="csv-cell-picker-search"
      placeholder="搜索或输入自定义值"
      @keydown.enter.prevent="submitCustom"
    />
    <div class="csv-cell-picker-list">
      <template v-for="group in filteredGroups" :key="group.key">
        <div v-if="group.label" class="csv-cell-picker-group">{{ group.label }}</div>
        <button
          v-for="option in group.options"
          :key="option.value"
          :class="['csv-cell-picker-option', { selected: selectedValues.has(option.value) }]"
          :title="option.description ?? undefined"
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
import { groupSelectOptions, type SelectOption } from '@/domain/schema/schema-options';

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
  minWidth: `${Math.max(props.anchor.width, 220)}px`,
  top: `${props.anchor.top + props.anchor.height + 2}px`,
  width: `${Math.min(Math.max(props.anchor.width, 300), 600)}px`,
}));
const groups = computed(() => groupSelectOptions(props.options));
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

function submitCustom() {
  const trimmed = query.value.trim();
  if (!trimmed) return;
  if (props.multiple) {
    const next = new Set(props.values);
    next.add(trimmed);
    emit('update', [...next]);
  } else {
    emit('update', [trimmed]);
    emit('close');
  }
}

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (target?.closest?.('.csv-cell-picker')) return;
  emit('close');
}
</script>
