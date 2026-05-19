<template>
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
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { loadEditableFile } from '@/services/files.service';
import { saveFileEditorTextWithUserAction } from '@/orchestrators/file-editor-save.orchestrator';
import {
  emitFileEditorSaved,
  listenFileEditorFocusLine,
  listenFileEditorTextApplied,
} from '@/orchestrators/file-editor-window.orchestrator';
import { normalizeFsPath } from '@/shared/lib/paths';
import { useSettingsStore } from '@/stores/settings.store';
import { closeCurrentWebviewWindow } from '@/windows/current.window';

const params = new window.URLSearchParams(window.location.search);
const settings = useSettingsStore();
const feedback = useAppFeedback();
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
    feedback.error('缺少文件路径');
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
    feedback.error(error, '打开文件失败');
  } finally {
    loading.value = false;
  }
}

async function saveFile() {
  if (saving.value || loading.value) return;
  saving.value = true;
  try {
    const newText = text.value;
    const changes = await saveFileEditorTextWithUserAction(filePath, text.value);
    originalText.value = newText;
    await emitFileEditorSaved({
      path: filePath,
      changes,
    });
    feedback.success('文件已保存');
  } catch (error) {
    feedback.error(error, '保存文件失败');
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
  void listenFileEditorFocusLine(async (payload) => {
    if (payload.message) contextMessage.value = payload.message;
    if (payload.contextLabel) contextLabel.value = payload.contextLabel;
    if (payload.line) targetLine.value = payload.line;
    await nextTick();
    scrollToTargetLine();
  });
  void listenFileEditorTextApplied((payload) => {
    if (normalizeFsPath(payload.path) !== normalizeFsPath(filePath)) return;
    setTextSnapshot(payload.text);
    originalText.value = payload.text;
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
});
</script>
