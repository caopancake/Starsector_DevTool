import { computed, ref, type Ref } from 'vue';
import { deepClone } from '@/shared/lib/starsector';
import { stableDeepEqual } from '@/shared/lib/stable-compare';

export interface DraftSessionOptions<T> {
  clone?: (value: T) => T;
  equals?: (left: T, right: T) => boolean;
  externalNotice?: string;
}

export interface DraftSession<T> {
  baseValue: Ref<T>;
  dirty: Ref<boolean>;
  draftValue: Ref<T>;
  externalUpdateNotice: Ref<string>;
  hasPendingExternalValue: Ref<boolean>;
  pendingExternalValue: Ref<T | null>;
  revision: Ref<number>;
  applyExternal: (value: T) => void;
  clear: (value: T) => void;
  commitSaved: (value?: T) => void;
  loadBase: (value: T) => void;
  loadPendingExternal: () => void;
  resetDraft: () => void;
  setDraft: (value: T) => void;
}

const DEFAULT_EXTERNAL_NOTICE = '外部版本已更新，当前未保存草稿已保留。';

export function useDraftSession<T>(initialValue: T, options: DraftSessionOptions<T> = {}): DraftSession<T> {
  const clone = options.clone ?? deepClone;
  const equals = options.equals ?? stableDeepEqual;
  const baseValue = ref<T>(clone(initialValue)) as Ref<T>;
  const draftValue = ref<T>(clone(initialValue)) as Ref<T>;
  const pendingExternalValue = ref<T | null>(null) as Ref<T | null>;
  const revision = ref(0);

  const dirty = computed(() => !equals(baseValue.value, draftValue.value));
  const hasPendingExternalValue = computed(() => pendingExternalValue.value !== null);
  const externalUpdateNotice = computed(() =>
    pendingExternalValue.value !== null ? (options.externalNotice ?? DEFAULT_EXTERNAL_NOTICE) : '',
  );

  function loadBase(value: T) {
    const next = clone(value);
    const draftChanged = !equals(draftValue.value, next);
    baseValue.value = next;
    draftValue.value = clone(next);
    pendingExternalValue.value = null;
    if (draftChanged) revision.value += 1;
  }

  function setDraft(value: T) {
    draftValue.value = clone(value);
  }

  function applyExternal(value: T) {
    const next = clone(value);
    if (dirty.value) {
      pendingExternalValue.value = next;
      return;
    }
    loadBase(next);
  }

  function loadPendingExternal() {
    if (pendingExternalValue.value === null) return;
    loadBase(pendingExternalValue.value);
  }

  function commitSaved(value?: T) {
    const next = clone(value ?? draftValue.value);
    baseValue.value = next;
    draftValue.value = clone(next);
    pendingExternalValue.value = null;
  }

  function resetDraft() {
    draftValue.value = clone(baseValue.value);
  }

  function clear(value: T) {
    loadBase(value);
  }

  return {
    baseValue,
    dirty,
    draftValue,
    externalUpdateNotice,
    hasPendingExternalValue,
    pendingExternalValue,
    revision,
    applyExternal,
    clear,
    commitSaved,
    loadBase,
    loadPendingExternal,
    resetDraft,
    setDraft,
  };
}
