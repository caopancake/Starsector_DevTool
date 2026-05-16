import { ref, computed } from 'vue';
import { scanCoreGraphics } from '../../../shared/api/tauri';
import { useSettingsStore } from '../../../app/settings.store';
import { useProjectStore } from '../../project/project.store';

const graphicsPaths = ref<string[]>([]);
const loaded = ref(false);
const loading = ref(false);

/**
 * Composable to access core graphics image paths.
 * Call `loadGraphics()` once — it loads from starsector-core/graphics/ and caches.
 */
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
