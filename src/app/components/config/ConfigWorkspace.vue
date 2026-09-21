<template>
  <main class="config-workspace">
    <ConfigModOverview v-if="workspace.configView === 'mod-overview'" />
    <ConfigFileHistoryView v-else-if="workspace.configView === 'file-history'" />
    <ConfigModInfoEditor v-else-if="workspace.configView === 'mod-info'" />
    <ConfigFactionView v-else-if="workspace.configView === 'factions'" />
    <ConfigEntityFamilyView v-else-if="workspace.configView === 'skins'" family-id="skin" />
    <ConfigEntityFamilyView v-else-if="workspace.configView === 'variants'" family-id="variant" />
    <ConfigMissionView v-else-if="workspace.configView === 'mission'" />
  </main>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { preloadNaiveComponents } from '@/app/naive-ui.runtime';

const ConfigModOverview = defineAsyncComponent(() => import('@/app/components/config/ConfigModOverview.vue'));
const ConfigFileHistoryView = defineAsyncComponent(() => import('@/app/components/config/ConfigFileHistoryView.vue'));
const ConfigModInfoEditor = defineAsyncComponent(() => import('@/app/components/config/ConfigModInfoEditor.vue'));
const ConfigFactionView = defineAsyncComponent(() => import('@/app/components/config/ConfigFactionView.vue'));
const ConfigMissionView = defineAsyncComponent(() => import('@/app/components/config/ConfigMissionView.vue'));
const ConfigEntityFamilyView = defineAsyncComponent(() => import('@/app/components/config/ConfigEntityFamilyView.vue'));

const workspace = useWorkspaceStore();

onMounted(() => {
  preloadNaiveComponents();
});
</script>
