import { ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { saveModInfoAction } from '@/orchestrators/config-save.orchestrator';
import { deepClone } from '@/shared/lib/starsector';
import type { RowData } from '@/shared/types';
import type { FileSchema } from '@/domain/schema/schema.types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';
import { configModInfoEditorModel, configModInfoSaveData } from '@/domain/config/config-entities';

export function useConfigModInfoViewModel() {
  const project = useProjectStore();
  const feedback = useAppFeedback();
  const local = ref<RowData>({});
  const saving = ref(false);
  const schemaRuntimeContext = useSchemaRuntimeContext(() => project.activeManifest);

  watch(
    () => project.activeManifest?.modInfo,
    (modInfo) => {
      if (modInfo) local.value = configModInfoEditorModel(deepClone(modInfo));
    },
    { immediate: true },
  );

  async function saveModInfo(schema: FileSchema | null) {
    const manifest = project.activeManifest;
    if (!manifest || !schema) return;
    saving.value = true;
    try {
      const file = configModInfoSaveData(local.value, schema);
      await saveModInfoAction(manifest.sessionId, manifest.modRoot, file);
      if (project.activeManifest?.modRoot !== manifest.modRoot || project.activeManifest.sessionId !== manifest.sessionId) return;
      project.updateManifest(manifest.modRoot, { modInfo: deepClone(file) });
      feedback.success('mod_info.json 已保存');
    } catch (error) {
      feedback.error(error, '保存 mod_info.json 失败');
    } finally {
      saving.value = false;
    }
  }

  return { local, saving, schemaRuntimeContext, saveModInfo };
}
