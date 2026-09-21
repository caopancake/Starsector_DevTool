import { defineStore } from 'pinia';
import type { Ref } from 'vue';

interface DraftSessionRegistration {
  dirty: Readonly<Ref<boolean>>;
  modRoot: Readonly<Ref<string | null>>;
}

/**
 * 未保存工作的唯一注册表：所有"某 Mod 是否有未保存修改"的判定都从这里回答。
 * 值级草稿会话通过 registerDraftSession 登记；CSV 表格等其它机制通过
 * registerDirtySource 提供判定函数。消费方严禁再自行对多个来源做并集。
 */
export const useDraftSessionsStore = defineStore('draft-sessions', () => {
  const registrations = new Map<number, DraftSessionRegistration>();
  const dirtySources = new Set<(modRoot: string) => boolean>();
  let nextRegistrationId = 0;

  function registerDraftSession(modRoot: Readonly<Ref<string | null>>, dirty: Readonly<Ref<boolean>>): () => void {
    const registrationId = nextRegistrationId++;
    registrations.set(registrationId, { dirty, modRoot });
    return () => registrations.delete(registrationId);
  }

  function registerDirtySource(source: (modRoot: string) => boolean): () => void {
    dirtySources.add(source);
    return () => dirtySources.delete(source);
  }

  function hasDirtyDraftForMod(modRoot: string): boolean {
    return [...registrations.values()].some((registration) => registration.modRoot.value === modRoot && registration.dirty.value);
  }

  function hasUnsavedWorkForMod(modRoot: string): boolean {
    if (hasDirtyDraftForMod(modRoot)) return true;
    for (const source of dirtySources) {
      if (source(modRoot)) return true;
    }
    return false;
  }

  return { hasDirtyDraftForMod, hasUnsavedWorkForMod, registerDraftSession, registerDirtySource };
});
