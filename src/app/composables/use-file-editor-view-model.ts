import { computed, ref } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { loadEditableFileData, writeEditableFileText } from '@/services/files.service';
import {
  emitFileEditorSaved,
  listenFileEditorFocusLine,
  listenFileEditorTextApplied,
} from '@/orchestrators/file-editor-window.orchestrator';
import { normalizeFsPath } from '@/shared/lib/paths';
import type { UnlistenFn } from '@/windows/tauri.events';

export interface FileEditorViewModelParams {
  filePath: string | null;
  title: string;
  contextLabel: string;
  contextSeverity: string;
  contextMessage: string;
  line: string | null;
}

export function useFileEditorViewModel(params: FileEditorViewModelParams) {
  const feedback = useAppFeedback();
  const title = ref(params.title);
  const contextLabel = ref(params.contextLabel);
  const contextSeverity = ref(params.contextSeverity);
  const contextMessage = ref(params.contextMessage);
  const targetLine = ref(normalizeLine(params.line));
  const text = ref('');
  const originalText = ref('');
  const loading = ref(false);
  const saving = ref(false);
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  let unlistenFocusLine: UnlistenFn | null = null;
  let unlistenTextApplied: UnlistenFn | null = null;

  const dirty = computed(() => text.value !== originalText.value);
  const lineCount = computed(() => Math.max(1, text.value.split(/\r\n|\r|\n/).length));
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);
  const isErrorContext = computed(() => contextSeverity.value === 'error');

  async function initialize() {
    await loadFile();
    unlistenFocusLine = await listenFileEditorFocusLine((event) => {
      contextMessage.value = event.message ?? '';
      contextLabel.value = event.contextLabel ?? '信息';
      contextSeverity.value = event.contextSeverity ?? 'info';
      targetLine.value = normalizeEventLine(event.line);
    });
    unlistenTextApplied = await listenFileEditorTextApplied((event) => {
      if (!params.filePath) return;
      if (normalizeFsPath(event.path) !== normalizeFsPath(params.filePath)) return;
      setTextSnapshot(event.text);
      originalText.value = event.text;
    });
  }

  function dispose() {
    unlistenFocusLine?.();
    unlistenFocusLine = null;
    unlistenTextApplied?.();
    unlistenTextApplied = null;
  }

  async function loadFile() {
    if (!params.filePath) {
      feedback.error('缺少文件路径');
      return;
    }
    loading.value = true;
    try {
      const loaded = await loadEditableFileData(params.filePath);
      setTextSnapshot(loaded.text);
      originalText.value = loaded.text;
    } catch (error) {
      feedback.error(error, '打开文件失败');
    } finally {
      loading.value = false;
    }
  }

  async function saveFile() {
    if (!params.filePath) {
      feedback.error('缺少文件路径');
      return;
    }
    if (saving.value || loading.value) return;
    saving.value = true;
    try {
      const newText = text.value;
      const result = await writeEditableFileText(params.filePath, newText);
      originalText.value = newText;
      await emitFileEditorSaved({
        path: params.filePath,
        writeResult: result,
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
  }

  function setTextSnapshot(nextText: string) {
    text.value = nextText;
    undoStack.value = [];
    redoStack.value = [];
  }

  function updateText(nextText: string) {
    if (nextText === text.value) return;
    undoStack.value.push(text.value);
    redoStack.value = [];
    text.value = nextText;
  }

  function undoEdit() {
    if (!canUndo.value) return;
    redoStack.value.push(text.value);
    text.value = undoStack.value.pop() ?? text.value;
  }

  function redoEdit() {
    if (!canRedo.value) return;
    undoStack.value.push(text.value);
    text.value = redoStack.value.pop() ?? text.value;
  }

  return {
    title,
    contextLabel,
    contextSeverity,
    contextMessage,
    targetLine,
    text,
    loading,
    saving,
    dirty,
    lineCount,
    canUndo,
    canRedo,
    isErrorContext,
    initialize,
    dispose,
    saveFile,
    cancelChanges,
    updateText,
    undoEdit,
    redoEdit,
  };
}

function normalizeLine(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeEventLine(value: number | null): number | undefined {
  return value !== null && Number.isFinite(value) && value > 0 ? value : undefined;
}
