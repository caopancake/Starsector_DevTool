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

export interface UndoStackState<TEntry> {
  undoStack: TEntry[];
  redoStack: TEntry[];
  limit: number;
  sequence: number;
}

/**
 * 撤销/重做双栈的唯一状态形状。状态是纯数据（可被 `reactive()` 包装获得响应
 * 性），所有变更必须经下面的操作函数进行——操作以 state 为首参，包装后经
 * proxy 的每次变更都能被 Vue 追踪；闭包或裸对象直改不会触发响应式更新。
 */
export function createUndoStackState<TEntry>(limit = 100): UndoStackState<TEntry> {
  return { undoStack: [], redoStack: [], limit, sequence: 0 };
}

export function nextUndoStackId<TEntry>(state: UndoStackState<TEntry>, idPrefix: string): string {
  return `${idPrefix}_${Date.now()}_${++state.sequence}`;
}

export function canUndoEntry<TEntry>(state: UndoStackState<TEntry>): boolean {
  return state.undoStack.length > 0;
}

export function canRedoEntry<TEntry>(state: UndoStackState<TEntry>): boolean {
  return state.redoStack.length > 0;
}

export function peekUndoEntry<TEntry>(state: UndoStackState<TEntry>): TEntry | undefined {
  return state.undoStack[state.undoStack.length - 1];
}

export function peekRedoEntry<TEntry>(state: UndoStackState<TEntry>): TEntry | undefined {
  return state.redoStack[state.redoStack.length - 1];
}

export function pushUndoEntry<TEntry>(state: UndoStackState<TEntry>, entry: TEntry, { clearRedo = true } = {}): void {
  state.undoStack.push(entry);
  if (clearRedo) state.redoStack.length = 0;
  trimUndoStack(state);
}

export function pushRedoEntry<TEntry>(state: UndoStackState<TEntry>, entry: TEntry): void {
  state.redoStack.push(entry);
}

export function popUndoEntry<TEntry>(state: UndoStackState<TEntry>): TEntry | undefined {
  return state.undoStack.pop();
}

export function popRedoEntry<TEntry>(state: UndoStackState<TEntry>): TEntry | undefined {
  return state.redoStack.pop();
}

export function clearUndoStack<TEntry>(state: UndoStackState<TEntry>): void {
  state.undoStack.length = 0;
  state.redoStack.length = 0;
}

export function setUndoStackLimit<TEntry>(state: UndoStackState<TEntry>, limit: number): void {
  state.limit = limit;
  trimUndoStack(state);
}

function trimUndoStack<TEntry>(state: UndoStackState<TEntry>): void {
  while (state.undoStack.length > state.limit) state.undoStack.shift();
}
