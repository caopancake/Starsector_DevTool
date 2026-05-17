<template>
  <main class="config-workspace">
    <ModOverview v-if="workspace.configView === 'mod-overview'" />
    <ModInfoEditor v-else-if="workspace.configView === 'mod-info'" />
    <div v-else-if="workspace.configView === 'factions'" class="config-factions-layout">
      <FactionList @select="selectedFaction = $event" />
      <FactionEditor v-if="selectedFaction" :key="selectedFaction" :faction-id="selectedFaction" />
      <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
    </div>
    <MissionView v-else-if="workspace.configView === 'mission'" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceStore } from '../../workspace/workspace.store';
import ModOverview from './ModOverview.vue';
import ModInfoEditor from './ModInfoEditor.vue';
import FactionList from './FactionList.vue';
import FactionEditor from './FactionEditor.vue';
import MissionView from './MissionView.vue';

const workspace = useWorkspaceStore();
const selectedFaction = ref('');
</script>
