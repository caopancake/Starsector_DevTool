import { computed, ref, type Ref } from 'vue';
import { createEditSessionValue, type EditSessionValueOptions } from '@/domain/edit-session';

const DEFAULT_EXTERNAL_NOTICE = '外部版本已更新，当前未保存草稿已保留。';

export interface DraftSessionOptions<T> extends EditSessionValueOptions<T> {
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

export function useDraftSession<T>(initialValue: T, options: DraftSessionOptions<T> = {}): DraftSession<T> {
  const { externalNotice, ...sessionOptions } = options;
  const session = createEditSessionValue(initialValue, sessionOptions);

  const baseValue = ref<T>(session.baseline) as Ref<T>;
  const draftValue = ref<T>(session.draft) as Ref<T>;
  const pendingExternalValue = ref<T | null>(session.pendingExternal) as Ref<T | null>;
  const revision = ref(session.revision);

  function dispatch(action: () => void): void {
    action();
    baseValue.value = session.baseline;
    draftValue.value = session.draft;
    pendingExternalValue.value = session.pendingExternal;
    revision.value = session.revision;
  }

  const dirty = computed(() => session.dirty);
  const hasPendingExternalValue = computed(() => session.hasPendingExternal);
  const externalUpdateNotice = computed(() => (session.hasPendingExternal ? (externalNotice ?? DEFAULT_EXTERNAL_NOTICE) : ''));

  return {
    baseValue,
    dirty,
    draftValue,
    externalUpdateNotice,
    hasPendingExternalValue,
    pendingExternalValue,
    revision,
    applyExternal: (value) => dispatch(() => session.applyExternal(value)),
    clear: (value) => dispatch(() => session.clear(value)),
    commitSaved: (value) => dispatch(() => session.commitSaved(value)),
    loadBase: (value) => dispatch(() => session.loadBaseline(value)),
    loadPendingExternal: () => dispatch(() => session.loadPendingExternal()),
    resetDraft: () => dispatch(() => session.resetDraft()),
    setDraft: (value) => dispatch(() => session.setDraft(value)),
  };
}
