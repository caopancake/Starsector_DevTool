import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { createUndoStack, type UndoStack } from '@/domain/edit-session';
import { AppError } from '@/shared/lib/errors';
import type { FileChangeRecord } from '@/shared/types';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';

type FileHistoryStack = UndoStack<FileSaveHistoryEntry>;

function createFileHistoryStack(): FileHistoryStack {
  return createUndoStack<FileSaveHistoryEntry>({ idPrefix: 'file_hist' });
}

export const useFileHistoryStore = defineStore('fileHistory', () => {
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
    stack.push({ id: stack.nextId(), timestamp: Date.now(), kind: 'file-save', changes, label });
  }

  function peekSavedWriteUndo(modRoot: string | null): FileSaveHistoryEntry | null {
    return getStack(modRoot)?.peekUndo() ?? null;
  }

  function peekSavedWriteRedo(modRoot: string | null): FileSaveHistoryEntry | null {
    return getStack(modRoot)?.peekRedo() ?? null;
  }

  function commitReplayUndo(modRoot: string | null, entryId: string): boolean {
    const stack = getStack(modRoot);
    const top = stack?.peekUndo();
    if (!stack || !top || top.id !== entryId) return false;
    stack.popUndo();
    stack.pushRedo(top);
    return true;
  }

  function commitReplayRedo(modRoot: string | null, entryId: string): boolean {
    const stack = getStack(modRoot);
    const top = stack?.peekRedo();
    if (!stack || !top || top.id !== entryId) return false;
    stack.popRedo();
    stack.pushUndo(top);
    return true;
  }

  function clearForMod(modRoot: string) {
    getStack(modRoot)?.clear();
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
    for (const stack of stateMap.values()) stack.setLimit(limit);
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
