<template>
  <div class="config-factions-layout">
    <ConfigFactionList
      :selected-id="selectedFaction"
      :factions="factions"
      :faction-crests="factionCrests"
      :mod-root="modRoot"
      :session-id="sessionId"
      :create-faction="createFaction"
      :delete-faction="deleteFaction"
      @select="selectedFaction = $event"
    />
    <ConfigFactionEditor
      v-if="selectedFaction"
      :key="selectedFaction"
      :faction-id="selectedFaction"
      :data-revision="factionDataRevision"
      :preview-revision="factionPreviewRevision"
      :factions="factions"
      :mod-root="modRoot"
      :session-id="sessionId"
      :query-preview-images="queryFactionPreviewImages"
      :schema-runtime-context="schemaRuntimeContext"
      :save-faction="saveFaction"
      :delete-faction="deleteFaction"
      @saved="onSaved"
    />
    <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
  </div>
</template>

<script setup lang="ts">
import ConfigFactionList from '@/app/components/config/ConfigFactionList.vue';
import ConfigFactionEditor from '@/app/components/config/ConfigFactionEditor.vue';
import { useConfigFactionViewModel } from '@/app/composables/use-config-faction-view-model';

const {
  selectedFaction,
  factionDataRevision,
  factionPreviewRevision,
  factions,
  factionCrests,
  modRoot,
  sessionId,
  schemaRuntimeContext,
  createFaction,
  deleteFaction,
  onSaved,
  queryFactionPreviewImages,
  saveFaction,
} = useConfigFactionViewModel();
</script>
