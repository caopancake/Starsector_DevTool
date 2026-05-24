import { computed, ref } from 'vue';
import { scanCoreFields } from '@/services/assets.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { getSchema, mergeSchemaWithCoreFields } from '@/domain/schema/schema-registry';
import type { FileSchema } from '@/domain/schema/schema.types';

type CoreFields = Awaited<ReturnType<typeof scanCoreFields>>;

const coreFields = ref<CoreFields>({});
const loaded = ref(false);
const loading = ref(false);

export function useCoreSchema() {
  const settings = useSettingsStore();
  const project = useProjectStore();

  const starsectorRoot = computed(() => settings.starsectorRoot || project.activeManifest?.starsectorRoot || '');

  async function loadCoreFields() {
    const root = starsectorRoot.value;
    if (!root || loading.value) return;
    loading.value = true;
    try {
      coreFields.value = await scanCoreFields(root);
      loaded.value = true;
    } catch {
      coreFields.value = {};
    } finally {
      loading.value = false;
    }
  }

  function getMergedSchema(id: string): FileSchema | null {
    const staticSchema = getSchema(id);
    if (!staticSchema) return null;
    const fields = coreFields.value[id] ?? [];
    return mergeSchemaWithCoreFields(staticSchema, fields);
  }

  return {
    coreFields,
    loaded,
    loading,
    starsectorRoot,
    getMergedSchema,
    loadCoreFields,
  };
}
