<template>
  <div class="csv-cell-text-editor" :style="editorStyle" tabindex="-1" @mousedown.stop>
    <textarea
      ref="textRef"
      v-model="draft"
      class="csv-cell-text-input"
      spellcheck="false"
      @keydown.enter.ctrl.prevent="commit"
      @keydown.esc.prevent="cancel"
    ></textarea>
    <div class="csv-cell-text-actions">
      <span class="csv-cell-text-hint">Ctrl+Enter 提交，Esc 取消</span>
      <button type="button" class="csv-cell-text-commit" @click="commit">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';

const props = defineProps<{
  anchor: { height: number; left: number; top: number; width: number };
  value: string;
}>();

const emit = defineEmits<{
  close: [];
  commit: [value: string];
}>();

// Mirrors the .csv-cell-text-editor height in tables.css.
const EDITOR_HEIGHT = 260;

const draft = ref(props.value);
const textRef = useTemplateRef<HTMLTextAreaElement>('textRef');

const editorStyle = computed(() => {
  const top = props.anchor.top + props.anchor.height + 2;
  const spaceBelow = window.innerHeight - top;
  // Open upward when the editor would be clipped by the window edge.
  const flipUp = spaceBelow < EDITOR_HEIGHT && props.anchor.top - 2 > spaceBelow;
  return {
    bottom: flipUp ? `${window.innerHeight - props.anchor.top + 2}px` : undefined,
    height: `${EDITOR_HEIGHT}px`,
    left: `${props.anchor.left}px`,
    top: flipUp ? undefined : `${top}px`,
    width: `${Math.min(Math.max(props.anchor.width, 300), 600)}px`,
  };
});

let settled = false;

function commit() {
  if (settled) return;
  settled = true;
  emit('commit', draft.value);
  emit('close');
}

function cancel() {
  if (settled) return;
  settled = true;
  emit('close');
}

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (target?.closest?.('.csv-cell-text-editor')) return;
  commit();
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown, true);
  nextTick(() => {
    const area = textRef.value;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  });
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown, true);
});
</script>
