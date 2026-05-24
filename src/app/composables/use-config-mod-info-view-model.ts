import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { useConfigStore } from '@/stores/config.store';
import { saveModInfoWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { deepClone } from '@/shared/lib/starsector';
import type { RowData } from '@/shared/types';
import type { FileSchema } from '@/domain/schema/schema.types';
import { aggregateSchemaSources, splitSchemaSources } from '@/domain/schema/schema-registry';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

export function useConfigModInfoViewModel() {
  const project = useProjectStore();
  const configStore = useConfigStore();
  const feedback = useAppFeedback();
  const local = ref<RowData>({});
  const saving = ref(false);
  const schemaRuntimeContext = computed(() =>
    project.activeManifest ? { modRoot: project.activeManifest.modRoot, sessionId: project.activeManifest.sessionId } : null,
  );

  watch(
    () => project.activeManifest?.modInfo,
    (modInfo) => {
      if (modInfo) local.value = aggregateSchemaSources({ file: deepClone(modInfo) });
    },
    { immediate: true },
  );

  async function saveModInfo(schema: FileSchema | null) {
    const manifest = project.activeManifest;
    if (!manifest || !schema) return;
    saving.value = true;
    try {
      const split = splitSchemaSources(local.value, schema);
      const file = split.file && typeof split.file === 'object' && !Array.isArray(split.file) ? (split.file as RowData) : {};
      await saveModInfoWithFileHistory(manifest.modRoot, file);
      project.updateManifest(manifest.modRoot, { ...manifest, modInfo: deepClone(file) });
      configStore.updateSnapshot(file);
      feedback.success('mod_info.json 已保存');
    } catch (error) {
      feedback.error(error, '保存 mod_info.json 失败');
    } finally {
      saving.value = false;
    }
  }

  return { local, saving, schemaRuntimeContext, saveModInfo };
}
