<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>Mod 信息</h1>
    </header>

    <div v-if="externalUpdateNotice" class="config-external-update-note">{{ externalUpdateNotice }}</div>

    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="draftData" :runtime-context="schemaRuntimeContext" />

    <footer class="settings-footer">
      <n-button v-if="hasPendingExternalData" secondary type="warning" @click="loadPendingExternalData">载入外部版本</n-button>
      <n-button type="primary" :loading="saving" :disabled="!dirty" @click="save">保存</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { useConfigModInfoViewModel } from '@/app/composables/use-config-mod-info-view-model';
import { registerActiveSaveHandler, unregisterActiveSaveHandler } from '@/shared/lib/save-command-registry';

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

onMounted(() => registerActiveSaveHandler(save));
onUnmounted(() => unregisterActiveSaveHandler(save));
</script>
