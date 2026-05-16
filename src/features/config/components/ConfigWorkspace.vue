<template>
  <main class="config-workspace">
    <ModInfoEditor v-if="workspace.configView === 'mod-info'" />
    <div v-else-if="workspace.configView === 'factions'" class="config-factions-layout">
      <FactionList @select="selectedFaction = $event" />
      <FactionEditor v-if="selectedFaction" :key="selectedFaction" :faction-id="selectedFaction" />
      <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
    </div>
    <div v-else-if="workspace.configView === 'campaign'" class="config-placeholder">
      <p>战役编辑（Phase 5.3）</p>
    </div>
    <div v-else-if="workspace.configView === 'world'" class="config-placeholder">
      <p>星系编辑（Phase 5.4）</p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceStore } from '../../workspace/workspace.store';
import ModInfoEditor from './ModInfoEditor.vue';
import FactionList from './FactionList.vue';
import FactionEditor from './FactionEditor.vue';

const workspace = useWorkspaceStore();
const selectedFaction = ref('');
</script>

<style scoped>
.config-workspace {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.config-factions-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.config-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}
</style>
