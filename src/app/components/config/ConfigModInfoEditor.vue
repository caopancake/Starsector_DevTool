<template>
  <div class="config-page">
    <header class="config-page-header">
      <h1>Mod 信息</h1>
    </header>

    <div v-if="externalUpdateNotice" class="config-external-update-note">{{ externalUpdateNotice }}</div>

    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="draftData" :runtime-context="schemaRuntimeContext" />

    <footer class="config-page-footer">
      <n-button v-if="hasPendingExternalData" secondary type="warning" @click="loadPendingExternalData">载入外部版本</n-button>
      <n-button type="primary" :loading="saving" :disabled="!dirty" @click="save">保存</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-assets';
import { useConfigModInfoViewModel } from '@/app/composables/config/use-config-mod-info-view-model';
import { useSaveCommandStore } from '@/stores/save-command.store';

const { getMergedSchema, loadCoreFields } = useCoreSchema();
void loadCoreFields();
const schema = computed(() => getMergedSchema('mod-info'));
const {
  dirty,
  draftData,
  externalUpdateNotice,
  hasPendingExternalData,
  loadPendingExternalData,
  saving,
  schemaRuntimeContext,
  saveModInfo,
} = useConfigModInfoViewModel();

async function save() {
  await saveModInfo(schema.value);
}

const saveCommand = useSaveCommandStore();
onMounted(() => saveCommand.registerActiveSaveHandler(save));
onUnmounted(() => saveCommand.unregisterActiveSaveHandler(save));
</script>
