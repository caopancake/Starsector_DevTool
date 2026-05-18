import { computed, ref } from 'vue';
import { scanCoreGraphics } from '@/services/assets.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';

const graphicsPaths = ref<string[]>([]);
const loaded = ref(false);
const loading = ref(false);

export function useCoreGraphics() {
  const settings = useSettingsStore();
  const project = useProjectStore();

  const starsectorRoot = computed(() => settings.starsectorRoot || project.activeModData?.starsectorRoot || '');

  async function loadGraphics() {
    const root = starsectorRoot.value;
    if (!root || loading.value || loaded.value) return;
    loading.value = true;
    try {
      graphicsPaths.value = await scanCoreGraphics(root);
      loaded.value = true;
    } catch {
      graphicsPaths.value = [];
    } finally {
      loading.value = false;
    }
  }

  return {
    graphicsPaths,
    loaded,
    loadGraphics,
    starsectorRoot,
  };
}
