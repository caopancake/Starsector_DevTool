<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>Mod 信息</h1>
    </header>

    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :runtime-context="schemaRuntimeContext" />

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save">保存</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { useConfigModInfoViewModel } from '@/app/composables/use-config-mod-info-view-model';

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();
const schema = computed(() => getMergedSchema('mod-info'));
const { local, saving, schemaRuntimeContext, saveModInfo } = useConfigModInfoViewModel();

function save() {
  void saveModInfo(schema.value);
}
</script>
