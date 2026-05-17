<template>
  <WindowShell>
    <main class="file-editor-page" :data-theme="settings.theme">
      <header class="file-editor-header">
        <div class="file-editor-heading">
          <div class="file-editor-title">{{ title }}</div>
          <div class="file-editor-path" :title="filePath">{{ filePath }}</div>
        </div>
        <div class="file-editor-actions">
          <n-button :disabled="!dirty || saving" @click="cancelChanges">取消</n-button>
          <n-button type="primary" :loading="saving" :disabled="!dirty" @click="saveFile">保存</n-button>
        </div>
      </header>

      <section v-if="contextMessage" class="file-editor-message">
        <span>{{ contextLabel }}</span>
        <p>{{ contextMessage }}</p>
      </section>

      <section class="file-editor-body" :aria-busy="loading">
        <div ref="lineGutterRef" class="file-editor-gutter" aria-hidden="true">
          <div
            v-for="lineNumber in lineCount"
            :key="lineNumber"
            :class="['file-editor-line-number', { active: lineNumber === targetLine }]"
          >
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
  </WindowShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { createDiscreteApi } from 'naive-ui';
import { loadEditableFile, saveTextFileWithHistory } from '../shared/api/tauri';
import { formatError } from '../shared/lib/errors';
import { useSettingsStore } from './settings.store';
import { buildThemeOverrides, discreteConfigProviderProps } from './theme-overrides';
import WindowShell from './WindowShell.vue';
import { WINDOW_EVENTS, type FileEditorFocusLineEvent, type FileEditorTextAppliedEvent } from '../features/windowing/window-events';

const params = new window.URLSearchParams(window.location.search);
const settings = useSettingsStore();
const filePath = params.get('file') ?? '';
const title = ref(params.get('title') ?? '文件编辑器');
const contextLabel = ref(params.get('contextLabel') ?? '信息');
const contextMessage = ref(params.get('message') ?? '');
const targetLine = ref(normalizeLine(params.get('line')));
const text = ref('');
const originalText = ref('');
const loading = ref(false);
const saving = ref(false);
const scrollTop = ref(0);
const lineHeight = 20;
const textareaRef = ref<HTMLTextAreaElement>();
const lineGutterRef = ref<HTMLElement>();
const undoStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);

const themeOverrides = computed(() => buildThemeOverrides(settings));

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

const dirty = computed(() => text.value !== originalText.value);
const lineCount = computed(() => Math.max(1, text.value.split(/\r\n|\r|\n/).length));
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

function normalizeLine(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function syncScroll() {
  scrollTop.value = textareaRef.value?.scrollTop ?? 0;
  if (lineGutterRef.value) lineGutterRef.value.scrollTop = scrollTop.value;
}

function scrollToTargetLine() {
  if (!targetLine.value || !textareaRef.value) return;
  textareaRef.value.scrollTop = Math.max(0, (targetLine.value - 4) * lineHeight);
  syncScroll();
}

async function loadFile() {
  if (!filePath) {
    message.error('缺少文件路径');
    return;
  }
  loading.value = true;
  try {
    const loaded = await loadEditableFile(filePath);
    setTextSnapshot(loaded.text);
    originalText.value = loaded.text;
    await nextTick();
    scrollToTargetLine();
  } catch (error) {
    message.error(`打开文件失败：${formatError(error)}`);
  } finally {
    loading.value = false;
  }
}

async function saveFile() {
  if (saving.value || loading.value) return;
  saving.value = true;
  try {
    const newText = text.value;
    const changes = await saveTextFileWithHistory(filePath, text.value);
    originalText.value = newText;
    await emit(WINDOW_EVENTS.fileEditorSaved, {
      path: filePath,
      changes,
    });
    message.success('文件已保存');
  } catch (error) {
    message.error(`保存文件失败：${formatError(error)}`);
  } finally {
    saving.value = false;
  }
}

function cancelChanges() {
  setTextSnapshot(originalText.value);
  void nextTick(scrollToTargetLine);
}

function setTextSnapshot(nextText: string) {
  text.value = nextText;
  undoStack.value = [];
  redoStack.value = [];
}

function handleTextInput(event: Event) {
  const nextText = (event.target as HTMLTextAreaElement).value;
  if (nextText === text.value) return;
  undoStack.value.push(text.value);
  redoStack.value = [];
  text.value = nextText;
}

function undoEdit() {
  if (!canUndo.value) return;
  redoStack.value.push(text.value);
  text.value = undoStack.value.pop() ?? text.value;
  void nextTick(restoreEditorFocus);
}

function redoEdit() {
  if (!canRedo.value) return;
  undoStack.value.push(text.value);
  text.value = redoStack.value.pop() ?? text.value;
  void nextTick(restoreEditorFocus);
}

function restoreEditorFocus() {
  textareaRef.value?.focus({ preventScroll: true });
}

async function closeEditorWindow() {
  await getCurrentWebviewWindow().close();
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
    redoEdit();
    return;
  }
  if (key === 'z') {
    event.preventDefault();
    undoEdit();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown);
  void loadFile();
  void listen<FileEditorFocusLineEvent>(WINDOW_EVENTS.fileEditorFocusLine, async (event) => {
    if (event.payload.message) contextMessage.value = event.payload.message;
    if (event.payload.contextLabel) contextLabel.value = event.payload.contextLabel;
    if (event.payload.line) targetLine.value = event.payload.line;
    await nextTick();
    scrollToTargetLine();
  });
  void listen<FileEditorTextAppliedEvent>(WINDOW_EVENTS.fileEditorTextApplied, (event) => {
    if (normalizePath(event.payload.path) !== normalizePath(filePath)) return;
    setTextSnapshot(event.payload.text);
    originalText.value = event.payload.text;
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
});

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
</script>
