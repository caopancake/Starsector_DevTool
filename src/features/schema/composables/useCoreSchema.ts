import { ref, computed } from 'vue';
import { scanCoreFields, type DiscoveredField } from '../../../shared/api/tauri';
import { useSettingsStore } from '../../../app/settings.store';
import { useProjectStore } from '../../project/project.store';
import { getSchema, mergeSchemaWithCoreFields } from '../schema.service';
import type { FileSchema } from '../schema.types';

const coreFields = ref<Record<string, DiscoveredField[]>>({});
const loaded = ref(false);
const loading = ref(false);

/**
 * Composable to access core-merged schemas.
 * Call `loadCoreFields()` once at app startup (or when starsector root changes).
 */
export function useCoreSchema() {
  const settings = useSettingsStore();
  const project = useProjectStore();

  const starsectorRoot = computed(() => {
    // Priority: user-configured > auto-detected
    return settings.starsectorRoot || project.activeModData?.starsectorRoot || '';
  });

  async function loadCoreFields() {
    const root = starsectorRoot.value;
    if (!root || loading.value) return;
    loading.value = true;
    try {
      coreFields.value = await scanCoreFields(root);
      loaded.value = true;
    } catch {
      // Non-critical: if scan fails, we just use static schemas
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
