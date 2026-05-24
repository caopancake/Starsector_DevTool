<template>
  <div class="config-factions-layout">
    <ConfigFactionList :selected-id="selectedFaction" :factions="factions" @select="selectedFaction = $event" @changed="loadFactions" />
    <ConfigFactionEditor
      v-if="selectedFaction"
      :key="selectedFaction"
      :faction-id="selectedFaction"
      :factions="factions"
      @saved="onSaved"
      @changed="loadFactions"
    />
    <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import ConfigFactionList from '@/app/components/config/ConfigFactionList.vue';
import ConfigFactionEditor from '@/app/components/config/ConfigFactionEditor.vue';
import { listFactionEntities } from '@/services/config.service';
import type { RowData } from '@/shared/types';
import { useProjectStore } from '@/stores/project.store';

const selectedFaction = ref('');
const factions = ref<Record<string, RowData>>({});
const project = useProjectStore();

async function loadFactions() {
  const sessionId = project.activeSessionId;
  if (!sessionId) {
    factions.value = {};
    selectedFaction.value = '';
    return;
  }
  factions.value = await listFactionEntities(sessionId);
  if (selectedFaction.value && !factions.value[selectedFaction.value]) selectedFaction.value = '';
  if (!selectedFaction.value) selectedFaction.value = Object.keys(factions.value).sort()[0] ?? '';
}

async function onSaved(id: string) {
  selectedFaction.value = id;
  await loadFactions();
}

onMounted(loadFactions);
watch(() => project.activeSessionId, loadFactions);
</script>
