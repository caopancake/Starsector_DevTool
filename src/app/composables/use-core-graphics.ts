import { computed, ref, watch } from 'vue';
import { queryCoreGraphics } from '@/services/assets.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { formatError } from '@/shared/lib/errors';

const graphicsPaths = ref<string[]>([]);
const loaded = ref(false);
const loading = ref(false);
const loadedRoot = ref<string | null>(null);

export function useCoreGraphics() {
  const settings = useSettingsStore();
  const project = useProjectStore();

  const starsectorRoot = computed(() => settings.starsectorRoot ?? project.activeManifest?.starsectorRoot ?? null);

  async function loadGraphics() {
    const root = starsectorRoot.value;
    if (!root) {
      resetGraphics();
      return;
    }
    if (loading.value || loadedRoot.value === root) return;
    if (loadedRoot.value !== root) resetGraphics();
    loading.value = true;
    try {
      const paths = await queryCoreGraphics(root);
      if (starsectorRoot.value === root) {
        graphicsPaths.value = paths;
        loadedRoot.value = root;
        loaded.value = true;
      }
    } catch (error) {
      if (starsectorRoot.value === root) {
        graphicsPaths.value = [];
        loadedRoot.value = null;
        loaded.value = false;
        recordLogBestEffort({
          level: 'error',
          message: `加载原版图片索引失败：${formatError(error)}`,
          path: root,
          line: null,
        });
      }
    } finally {
      loading.value = false;
    }
    if (starsectorRoot.value && starsectorRoot.value !== root) void loadGraphics();
  }

  function resetGraphics() {
    graphicsPaths.value = [];
    loadedRoot.value = null;
    loaded.value = false;
  }

  watch(starsectorRoot, () => {
    void loadGraphics();
  });

  return {
    graphicsPaths,
    loaded,
    loadGraphics,
    starsectorRoot,
  };
}
