<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>Mod 信息</h1>
    </header>

    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :app-data="project.activeModData" />

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save">保存</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { useConfigStore } from '@/stores/config.store';
import { saveModInfoWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { deepClone } from '@/shared/lib/starsector';
import type { RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { aggregateSchemaSources, splitSchemaSources } from '@/domain/schema/schema-registry';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const project = useProjectStore();
const configStore = useConfigStore();
const feedback = useAppFeedback();

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();
const schema = computed(() => getMergedSchema('mod-info'));
const saving = ref(false);
const local = ref<RowData>({});

watch(
  () => project.activeModData?.modInfo,
  (modInfo) => {
    if (modInfo) local.value = aggregateSchemaSources({ file: deepClone(modInfo) });
  },
  { immediate: true },
);

async function save() {
  const modData = project.activeModData;
  if (!modData) return;
  const currentSchema = schema.value;
  if (!currentSchema) return;
  saving.value = true;
  try {
    const split = splitSchemaSources(local.value, currentSchema);
    const file = split.file && typeof split.file === 'object' && !Array.isArray(split.file) ? (split.file as RowData) : {};
    await saveModInfoWithFileHistory(modData.modRoot, file);
    modData.modInfo = deepClone(file);
    configStore.updateSnapshot(file);
    feedback.success('mod_info.json 已保存');
  } catch (error) {
    feedback.error(error, '保存 mod_info.json 失败');
  } finally {
    saving.value = false;
  }
}
</script>
