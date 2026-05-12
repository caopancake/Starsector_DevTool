import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { loadModData } from '../../shared/api/tauri';
import type { AppData } from '../../shared/types';
import { cell } from '../../shared/lib/starsector';

export const useProjectStore = defineStore('project', () => {
  const data = ref<AppData | null>(null);
  const loading = ref(false);

  const projectName = computed(() => cell(data.value?.modInfo?.name) || 'Native Config Tool');
  const isOpen = computed(() => data.value !== null);

  async function pickAndOpenProject(): Promise<AppData | null> {
    const picked = await open({ directory: true, multiple: false, title: '选择 Starsector Mod 根目录' });
    if (!picked || Array.isArray(picked)) return null;
    return openProject(picked);
  }

  async function openProject(modRoot: string): Promise<AppData> {
    loading.value = true;
    try {
      const loaded = await loadModData(modRoot);
      data.value = loaded;
      return loaded;
    } finally {
      loading.value = false;
    }
  }

  return {
    data,
    isOpen,
    loading,
    projectName,
    openProject,
    pickAndOpenProject,
  };
});
