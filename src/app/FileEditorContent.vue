<template>
  <main class="file-editor-page" :data-theme="settings.theme">
    <header class="file-editor-header">
      <div class="file-editor-heading">
        <div class="file-editor-title-row">
          <div class="file-editor-title" :title="fileName">{{ fileName }}</div>
          <div class="file-editor-status" :class="{ dirty, saving, loading }">{{ fileStatusText }}</div>
        </div>
        <div class="file-editor-path" :title="filePathText">{{ displayPath }}</div>
        <div class="file-editor-meta" aria-label="文件信息">
          <span>{{ fileTypeText }}</span>
          <span>{{ lineCount }} 行</span>
          <span>{{ modRootName }}</span>
        </div>
      </div>
      <div class="file-editor-actions">
        <n-button v-if="hasPendingExternalText" secondary type="warning" @click="loadExternalText">载入外部文本</n-button>
        <n-button :disabled="!dirty || saving" @click="cancelFileChanges">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!dirty" @click="saveFile">保存</n-button>
      </div>
    </header>

    <section v-if="externalTextNotice" class="file-editor-message warning">
      <span>外部更新</span>
      <p>{{ externalTextNotice }}</p>
    </section>

    <section v-if="showContextMessage" :class="['file-editor-message', { danger: isErrorContext }]">
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useFileEditorViewModel } from '@/app/composables/use-file-editor-view-model';
import { useSettingsStore } from '@/stores/settings.store';
import { closeCurrentWebviewWindow } from '@/windows/current.window';
import { pathBasename, pathBelongsToRoot, relativePathFromRoot } from '@/shared/lib/paths';

const params = new window.URLSearchParams(window.location.search);
const settings = useSettingsStore();
const filePath = params.get('file');
const modRoot = params.get('modRoot');
const sessionId = params.get('sessionId');
const filePathText = filePath ?? '缺少文件路径';
const fileName = computed(() => (filePath ? pathBasename(filePath) : '缺少文件路径'));
const displayPath = computed(() => {
  if (!filePath) return '缺少文件路径';
  if (modRoot && pathBelongsToRoot(filePath, modRoot)) return relativePathFromRoot(modRoot, filePath);
  return filePath;
});
const fileTypeText = computed(() => {
  const name = fileName.value;
  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  return extension ? `${extension} 文本` : '文本文件';
});
const modRootName = computed(() => (modRoot ? pathBasename(modRoot) : '未知 Mod'));
const scrollTop = ref(0);
const lineHeight = 20;
const textareaRef = ref<HTMLTextAreaElement>();
const lineGutterRef = ref<HTMLElement>();
const {
  contextLabel,
  contextMessage,
  targetLine,
  text,
  loading,
  saving,
  dirty,
  hasPendingExternalText,
  externalTextNotice,
  lineCount,
  isErrorContext,
  initialize,
  dispose,
  saveFile,
  cancelChanges,
  loadPendingExternalText,
  updateText,
  undoEdit,
  redoEdit,
} = useFileEditorViewModel({
  filePath,
  modRoot,
  sessionId,
  title: params.get('title') ?? '文件编辑器',
  contextLabel: params.get('contextLabel') ?? '信息',
  contextSeverity: params.get('contextSeverity') ?? 'info',
  contextMessage: params.get('message') ?? '',
  line: params.get('line'),
});
const showContextMessage = computed(() => Boolean(contextMessage.value && (isErrorContext.value || targetLine.value)));
const fileStatusText = computed(() => {
  if (loading.value) return '读取中';
  if (saving.value) return '保存中';
  if (hasPendingExternalText.value) return '外部文本已更新';
  return dirty.value ? '未保存' : '已保存';
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

function loadExternalText() {
  loadPendingExternalText();
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
