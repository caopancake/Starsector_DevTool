import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import {
  clearUndoStack,
  createUndoStackState,
  nextUndoStackId,
  peekRedoEntry,
  peekUndoEntry,
  popRedoEntry,
  popUndoEntry,
  pushRedoEntry,
  pushUndoEntry,
  setUndoStackLimit,
  type UndoStackState,
} from '@/domain/edit-session';
import { AppError } from '@/shared/lib/errors';
import type { FileChangeRecord } from '@/shared/types';
import type { FileSaveHistoryEntry } from '@/shared/types';

type FileHistoryStack = UndoStackState<FileSaveHistoryEntry>;

function createFileHistoryStack(): FileHistoryStack {
  return createUndoStackState<FileSaveHistoryEntry>();
}

export const useFileHistoryStore = defineStore('file-history', () => {
  const stateMap = reactive<Map<string, FileHistoryStack>>(new Map());
  const activeRoot = ref<string | null>(null);
  const historyLimit = ref(100);

  function activateFor(modRoot: string | null) {
    activeRoot.value = modRoot;
    if (modRoot && !stateMap.has(modRoot)) stateMap.set(modRoot, createFileHistoryStack());
  }

  function removeModState(modRoot: string) {
    stateMap.delete(modRoot);
  }

  function getStack(modRoot: string | null): FileHistoryStack | undefined {
    return modRoot ? stateMap.get(modRoot) : undefined;
  }

  function pushSavedWriteEntry(modRoot: string, changes: FileChangeRecord[], label: string) {
    if (!modRoot) throw new AppError('无法记录文件历史：缺少 Mod 根目录', { action: 'push-saved-write-entry' });
    if (changes.length === 0) throw new AppError('无法记录文件历史：写入结果没有文件变更', { action: 'push-saved-write-entry' });
    const stack = getStack(modRoot) ?? stateMap.set(modRoot, createFileHistoryStack()).get(modRoot)!;
    pushUndoEntry(stack, { id: nextUndoStackId(stack, 'file_hist'), timestamp: Date.now(), kind: 'file-save', changes, label });
  }

  function peekSavedWriteUndo(modRoot: string | null): FileSaveHistoryEntry | null {
    const stack = getStack(modRoot);
    return stack ? (peekUndoEntry(stack) ?? null) : null;
  }

  function peekSavedWriteRedo(modRoot: string | null): FileSaveHistoryEntry | null {
    const stack = getStack(modRoot);
    return stack ? (peekRedoEntry(stack) ?? null) : null;
  }

  function commitReplayUndo(modRoot: string | null, entryId: string): boolean {
    const stack = getStack(modRoot);
    const top = stack ? peekUndoEntry(stack) : undefined;
    if (!stack || !top || top.id !== entryId) return false;
    popUndoEntry(stack);
    pushRedoEntry(stack, top);
    return true;
  }

  function commitReplayRedo(modRoot: string | null, entryId: string): boolean {
    const stack = getStack(modRoot);
    const top = stack ? peekRedoEntry(stack) : undefined;
    if (!stack || !top || top.id !== entryId) return false;
    popRedoEntry(stack);
    pushUndoEntry(stack, top, { clearRedo: false });
    return true;
  }

  function clearForMod(modRoot: string) {
    const stack = getStack(modRoot);
    if (stack) clearUndoStack(stack);
  }

  function getHistoryStacks(modRoot: string) {
    const stack = getStack(modRoot);
    return {
      undoStack: stack?.undoStack ?? [],
      redoStack: stack?.redoStack ?? [],
    };
  }

  function setHistoryLimit(limit: number) {
    historyLimit.value = limit;
    for (const stack of stateMap.values()) setUndoStackLimit(stack, limit);
  }

  return {
    activeRoot,
    activateFor,
    clearForMod,
    commitReplayRedo,
    commitReplayUndo,
    peekSavedWriteRedo,
    peekSavedWriteUndo,
    getHistoryStacks,
    removeModState,
    pushSavedWriteEntry,
    setHistoryLimit,
  };
});
