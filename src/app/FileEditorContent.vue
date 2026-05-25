<template>
  <main class="file-editor-page" :data-theme="settings.theme">
    <header class="file-editor-header">
      <div class="file-editor-heading">
        <div class="file-editor-title">{{ title }}</div>
        <div class="file-editor-path" :title="filePathText">{{ filePathText }}</div>
      </div>
      <div class="file-editor-actions">
        <n-button :disabled="!dirty || saving" @click="cancelFileChanges">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!dirty" @click="saveFile">保存</n-button>
      </div>
    </header>

    <section v-if="contextMessage" :class="['file-editor-message', { danger: isErrorContext }]">
      <span>{{ contextLabel }}</span>
      <p>{{ contextMessage }}</p>
    </section>

    <section class="file-editor-body" :aria-busy="loading">
      <div ref="lineGutterRef" class="file-editor-gutter" aria-hidden="true">
        <div v-for="lineNumber in lineCount" :key="lineNumber" :class="['file-editor-line-number', { active: lineNumber === targetLine }]">
          {{ lineNumber }}
        </div>
      </div>
      <textarea
        ref="textareaRef"
        :value="text"
        class="file-editor-textarea"
        spellcheck="false"
        :disabled="loading || saving"
        @input="handleTextInput"
        @scroll="syncScroll"
      />
      <div
        v-if="targetLine"
        ref="highlightRef"
        class="file-editor-line-highlight"
        :style="{ top: `${(targetLine - 1) * lineHeight - scrollTop}px` }"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useFileEditorViewModel } from '@/app/composables/use-file-editor-view-model';
import { useSettingsStore } from '@/stores/settings.store';
import { closeCurrentWebviewWindow } from '@/windows/current.window';

const params = new window.URLSearchParams(window.location.search);
const settings = useSettingsStore();
const filePath = params.get('file');
const filePathText = filePath ?? '缺少文件路径';
const scrollTop = ref(0);
const lineHeight = 20;
const textareaRef = ref<HTMLTextAreaElement>();
const lineGutterRef = ref<HTMLElement>();
const {
  title,
  contextLabel,
  contextMessage,
  targetLine,
  text,
  loading,
  saving,
  dirty,
  lineCount,
  isErrorContext,
  initialize,
  dispose,
  saveFile,
  cancelChanges,
  updateText,
  undoEdit,
  redoEdit,
} = useFileEditorViewModel({
  filePath,
  title: params.get('title') ?? '文件编辑器',
  contextLabel: params.get('contextLabel') ?? '信息',
  contextSeverity: params.get('contextSeverity') ?? 'info',
  contextMessage: params.get('message') ?? '',
  line: params.get('line'),
});

function syncScroll() {
  scrollTop.value = textareaRef.value?.scrollTop ?? 0;
  if (lineGutterRef.value) lineGutterRef.value.scrollTop = scrollTop.value;
}

function scrollToTargetLine() {
  if (!targetLine.value || !textareaRef.value) return;
  textareaRef.value.scrollTop = Math.max(0, (targetLine.value - 4) * lineHeight);
  syncScroll();
}

function handleTextInput(event: Event) {
  const nextText = (event.target as HTMLTextAreaElement).value;
  updateText(nextText);
}

function restoreEditorFocus() {
  textareaRef.value?.focus({ preventScroll: true });
}

function undoTextEdit() {
  undoEdit();
  void nextTick(restoreEditorFocus);
}

function redoTextEdit() {
  redoEdit();
  void nextTick(restoreEditorFocus);
}

function cancelFileChanges() {
  cancelChanges();
  void nextTick(scrollToTargetLine);
}

async function closeEditorWindow() {
  await closeCurrentWebviewWindow();
}

function handleEditorKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    void closeEditorWindow();
    return;
  }

  if (!(event.ctrlKey || event.metaKey)) return;

  const key = event.key.toLowerCase();
  if (key === 's') {
    event.preventDefault();
    void saveFile();
    return;
  }
  if (key === 'z' && event.shiftKey) {
    event.preventDefault();
    redoTextEdit();
    return;
  }
  if (key === 'z') {
    event.preventDefault();
    undoTextEdit();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown);
  void initialize().then(async () => {
    await nextTick();
    scrollToTargetLine();
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
  dispose();
});
</script>
