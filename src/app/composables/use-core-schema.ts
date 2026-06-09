import { computed, ref, watch } from 'vue';
import { queryCoreFields } from '@/services/assets.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { mergeSchemaWithCoreFields } from '@/domain/schema/schema-core-fields';
import { getSchema } from '@/domain/schema/schema-registry';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { formatError } from '@/shared/lib/errors';
import type { FileSchema } from '@/domain/schema/schema.types';

type CoreFields = Awaited<ReturnType<typeof queryCoreFields>>;

const coreFields = ref<CoreFields>({});
const loaded = ref(false);
const loading = ref(false);
const loadedRoot = ref<string | null>(null);

export function useCoreSchema() {
  const settings = useSettingsStore();
  const project = useProjectStore();

  const starsectorRoot = computed(() => settings.starsectorRoot ?? project.activeManifest?.starsectorRoot ?? null);

  async function loadCoreFields() {
    const root = starsectorRoot.value;
    if (!root) {
      resetCoreFields();
      return;
    }
    if (loading.value || loadedRoot.value === root) return;
    if (loadedRoot.value !== root) resetCoreFields();
    loading.value = true;
    try {
      const fields = await queryCoreFields(root);
      if (starsectorRoot.value === root) {
        coreFields.value = fields;
        loadedRoot.value = root;
        loaded.value = true;
      }
    } catch (error) {
      if (starsectorRoot.value === root) {
        coreFields.value = {};
        loadedRoot.value = null;
        loaded.value = false;
        recordLogBestEffort({
          level: 'error',
          message: `加载原版字段失败：${formatError(error)}`,
          path: root,
          line: null,
        });
      }
    } finally {
      loading.value = false;
    }
    if (starsectorRoot.value && starsectorRoot.value !== root) void loadCoreFields();
  }

  function resetCoreFields() {
    coreFields.value = {};
    loadedRoot.value = null;
    loaded.value = false;
  }

  function getMergedSchema(id: string): FileSchema | null {
    const staticSchema = getSchema(id);
    if (!staticSchema) return null;
    const fields = coreFields.value[id] ?? [];
    return mergeSchemaWithCoreFields(staticSchema, fields);
  }

  watch(starsectorRoot, () => {
    void loadCoreFields();
  });

  return {
    coreFields,
    loaded,
    loading,
    starsectorRoot,
    getMergedSchema,
    loadCoreFields,
  };
}
