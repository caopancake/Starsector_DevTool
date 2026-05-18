<template>
  <main class="config-workspace">
    <ModOverview v-if="workspace.configView === 'mod-overview'" />
    <FileHistoryView v-else-if="workspace.configView === 'file-history'" />
    <ModInfoEditor v-else-if="workspace.configView === 'mod-info'" />
    <FactionView v-else-if="workspace.configView === 'factions'" />
    <VariantView v-else-if="workspace.configView === 'variants'" />
    <MissionView v-else-if="workspace.configView === 'mission'" />
  </main>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '../../workspace/workspace-store';
import ModOverview from './ModOverview.vue';
import FileHistoryView from './FileHistoryView.vue';
import ModInfoEditor from './ModInfoEditor.vue';
import FactionView from './FactionView.vue';
import MissionView from './MissionView.vue';
import VariantView from './VariantView.vue';

const workspace = useWorkspaceStore();
</script>
