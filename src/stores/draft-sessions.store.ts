import { defineStore } from 'pinia';
import type { Ref } from 'vue';

interface DraftSessionRegistration {
  dirty: Readonly<Ref<boolean>>;
  modRoot: Readonly<Ref<string | null>>;
}

export const useDraftSessionsStore = defineStore('draft-sessions', () => {
  const registrations = new Map<number, DraftSessionRegistration>();
  let nextRegistrationId = 0;

  function registerDraftSession(modRoot: Readonly<Ref<string | null>>, dirty: Readonly<Ref<boolean>>): () => void {
    const registrationId = nextRegistrationId++;
    registrations.set(registrationId, { dirty, modRoot });
    return () => registrations.delete(registrationId);
  }

  function hasDirtyDraftForMod(modRoot: string): boolean {
    return [...registrations.values()].some((registration) => registration.modRoot.value === modRoot && registration.dirty.value);
  }

  return { hasDirtyDraftForMod, registerDraftSession };
});
