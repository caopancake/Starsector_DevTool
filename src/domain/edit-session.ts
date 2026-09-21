import { deepClone } from '@/shared/lib/starsector';
import { stableDeepEqual } from '@/shared/lib/stable-compare';

/**
 * 统一编辑会话原语（框架无关，可在边界被 `reactive()` 包装获得响应性）。
 * 全仓的"基线-草稿-dirty-外部更新挂起"与"撤销/重做栈"只允许这两个 owner 实现；
 * 各编辑机制（配置草稿、文本撤销、CSV 撤销、文件历史）是它们的特化或包装。
 */

export interface EditSessionValueOptions<T> {
  clone?: (value: T) => T;
  equals?: (left: T, right: T) => boolean;
}

export interface EditSessionValue<T> {
  readonly baseline: T;
  readonly draft: T;
  readonly pendingExternal: T | null;
  readonly revision: number;
  readonly dirty: boolean;
  readonly hasPendingExternal: boolean;
  loadBaseline(value: T): void;
  setDraft(value: T): void;
  applyExternal(value: T): void;
  loadPendingExternal(): void;
  commitSaved(value?: T): void;
  resetDraft(): void;
  clear(value: T): void;
}

export function createEditSessionValue<T>(initialValue: T, options: EditSessionValueOptions<T> = {}): EditSessionValue<T> {
  const clone = options.clone ?? deepClone;
  const equals = options.equals ?? stableDeepEqual;
  const state = {
    baseline: clone(initialValue),
    draft: clone(initialValue),
    pendingExternal: null as T | null,
    revision: 0,
  };

  function loadBaseline(value: T): void {
    const next = clone(value);
    const draftChanged = !equals(state.draft, next);
    state.baseline = next;
    state.draft = clone(next);
    state.pendingExternal = null;
    if (draftChanged) state.revision += 1;
  }

  return {
    get baseline() {
      return state.baseline;
    },
    get draft() {
      return state.draft;
    },
    get pendingExternal() {
      return state.pendingExternal;
    },
    get revision() {
      return state.revision;
    },
    get dirty() {
      return !equals(state.baseline, state.draft);
    },
    get hasPendingExternal() {
      return state.pendingExternal !== null;
    },
    loadBaseline,
    setDraft(value) {
      state.draft = clone(value);
    },
    applyExternal(value) {
      const next = clone(value);
      if (!equals(state.baseline, state.draft)) {
        state.pendingExternal = next;
        return;
      }
      loadBaseline(next);
    },
    loadPendingExternal() {
      if (state.pendingExternal === null) return;
      loadBaseline(state.pendingExternal);
    },
    commitSaved(value) {
      const next = clone(value ?? state.draft);
      state.baseline = next;
      state.draft = clone(next);
      state.pendingExternal = null;
    },
    resetDraft() {
      state.draft = clone(state.baseline);
    },
    clear(value) {
      loadBaseline(value);
    },
  };
}

export interface UndoStackOptions {
  limit?: number;
  idPrefix?: string;
}

export interface UndoStack<TEntry> {
  readonly undoStack: readonly TEntry[];
  readonly redoStack: readonly TEntry[];
  readonly limit: number;
  nextId(): string;
  push(entry: TEntry): void;
  pushUndo(entry: TEntry): void;
  pushRedo(entry: TEntry): void;
  canUndo(): boolean;
  canRedo(): boolean;
  peekUndo(): TEntry | undefined;
  peekRedo(): TEntry | undefined;
  popUndo(): TEntry | undefined;
  popRedo(): TEntry | undefined;
  clear(): void;
  setLimit(limit: number): void;
}

let entrySequence = 0;

export function createUndoStack<TEntry>(options: UndoStackOptions = {}): UndoStack<TEntry> {
  const limit = options.limit ?? 100;
  const idPrefix = options.idPrefix ?? 'entry';
  const state = { undoStack: [] as TEntry[], redoStack: [] as TEntry[], limit };

  function trimToLimit(): void {
    while (state.undoStack.length > state.limit) state.undoStack.shift();
  }

  return {
    get undoStack() {
      return state.undoStack;
    },
    get redoStack() {
      return state.redoStack;
    },
    get limit() {
      return state.limit;
    },
    nextId() {
      return `${idPrefix}_${Date.now()}_${++entrySequence}`;
    },
    push(entry) {
      state.undoStack.push(entry);
      state.redoStack.length = 0;
      trimToLimit();
    },
    pushUndo(entry) {
      state.undoStack.push(entry);
    },
    pushRedo(entry) {
      state.redoStack.push(entry);
    },
    canUndo() {
      return state.undoStack.length > 0;
    },
    canRedo() {
      return state.redoStack.length > 0;
    },
    peekUndo() {
      return state.undoStack[state.undoStack.length - 1];
    },
    peekRedo() {
      return state.redoStack[state.redoStack.length - 1];
    },
    popUndo() {
      return state.undoStack.pop();
    },
    popRedo() {
      return state.redoStack.pop();
    },
    clear() {
      state.undoStack.length = 0;
      state.redoStack.length = 0;
    },
    setLimit(nextLimit) {
      state.limit = nextLimit;
      trimToLimit();
    },
  };
}
