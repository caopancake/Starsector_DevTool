<template>
  <main class="config-workspace">
    <ConfigModOverview v-if="workspace.configView === 'mod-overview'" />
    <ConfigFileHistoryView v-else-if="workspace.configView === 'file-history'" />
    <ConfigModInfoEditor v-else-if="workspace.configView === 'mod-info'" />
    <ConfigFactionView v-else-if="workspace.configView === 'factions'" />
    <ConfigSkinView v-else-if="workspace.configView === 'skins'" />
    <ConfigVariantView v-else-if="workspace.configView === 'variants'" />
    <ConfigMissionView v-else-if="workspace.configView === 'mission'" />
  </main>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '@/stores/workspace.store';
import ConfigModOverview from '@/app/components/config/ConfigModOverview.vue';
import ConfigFileHistoryView from '@/app/components/config/ConfigFileHistoryView.vue';
import ConfigModInfoEditor from '@/app/components/config/ConfigModInfoEditor.vue';
import ConfigFactionView from '@/app/components/config/ConfigFactionView.vue';
import ConfigMissionView from '@/app/components/config/ConfigMissionView.vue';
import ConfigSkinView from '@/app/components/config/ConfigSkinView.vue';
import ConfigVariantView from '@/app/components/config/ConfigVariantView.vue';

const workspace = useWorkspaceStore();
</script>
