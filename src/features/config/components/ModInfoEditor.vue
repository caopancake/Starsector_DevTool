<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>Mod 信息</h1>
    </header>

    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :app-data="project.activeModData" />

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save">保存 mod_info.json</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useConfigStore } from '../config.store';
import { useHistoryStore } from '../../history/history.store';
import { useSettingsStore } from '../../../app/settings.store';
import { saveModInfoData } from '../config.service';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { RowData } from '../../../shared/types';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { useCoreSchema } from '../../schema/composables/useCoreSchema';

const project = useProjectStore();
const configStore = useConfigStore();
const historyStore = useHistoryStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();
const schema = computed(() => getMergedSchema('mod-info'));
const saving = ref(false);
const local = ref<RowData>({});

watch(
  () => project.activeModData?.modInfo,
  (modInfo) => {
    if (modInfo) local.value = deepClone(modInfo);
  },
  { immediate: true },
);

async function save() {
  const modData = project.activeModData;
  if (!modData) return;
  saving.value = true;
  try {
    const previousSpec = deepClone(modData.modInfo);
    await saveModInfoData(modData.modRoot, local.value);
    modData.modInfo = deepClone(local.value);
    configStore.updateSnapshot(local.value);
    historyStore.pushEvent(
      { type: 'editor-save', editorKind: 'ship', id: '__mod_info__', previousSpec, newSpec: deepClone(local.value) },
      '保存 mod_info.json',
    );
    historyStore.pushCheckpoint('editor-save', 'mod_info.json 已保存');
    message.success('mod_info.json 已保存');
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}
</script>
