import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ProjectManifest, ProjectSessionId } from '@/shared/types';
import { cell } from '@/shared/lib/starsector';
import { getNextActiveKeyAfterRemoval } from '@/shared/lib/store-utils';

export const useProjectStore = defineStore('project', () => {
  const manifests = ref<Map<string, ProjectManifest>>(new Map());
  const activeModRoot = ref<string | null>(null);
  const loading = ref(false);

  const activeManifest = computed<ProjectManifest | null>(() =>
    activeModRoot.value ? (manifests.value.get(activeModRoot.value) ?? null) : null,
  );
  const activeSessionId = computed<ProjectSessionId | null>(() => activeManifest.value?.sessionId ?? null);
  const projectName = computed(() => cell(activeManifest.value?.modInfo?.name) || 'Starsector DevTool');
  const isOpen = computed(() => manifests.value.size > 0);

  function setActiveModRoot(modRoot: string | null) {
    activeModRoot.value = modRoot;
  }

  function getManifest(modRoot: string): ProjectManifest | null {
    return manifests.value.get(modRoot) ?? null;
  }

  function getSessionId(modRoot: string): ProjectSessionId | null {
    return getManifest(modRoot)?.sessionId ?? null;
  }

  function removeModData(modRoot: string) {
    manifests.value.delete(modRoot);
    activeModRoot.value = getNextActiveKeyAfterRemoval(activeModRoot.value, [...manifests.value.keys()], modRoot, null);
  }

  function setLoading(value: boolean) {
    loading.value = value;
  }

  function setProjectManifest(manifest: ProjectManifest) {
    manifests.value.set(manifest.modRoot, manifest);
    activeModRoot.value = manifest.modRoot;
  }

  function updateManifest(modRoot: string, patch: Partial<ProjectManifest>) {
    const current = manifests.value.get(modRoot);
    if (!current) return;
    manifests.value.set(modRoot, { ...current, ...patch });
  }

  return {
    activeManifest,
    activeModRoot,
    activeSessionId,
    isOpen,
    loading,
    manifests,
    projectName,
    getManifest,
    getSessionId,
    removeModData,
    setActiveModRoot,
    setLoading,
    setProjectManifest,
    updateManifest,
  };
});
