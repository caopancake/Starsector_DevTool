<template>
  <div class="config-factions-layout">
    <ConfigFactionList :selected-id="selectedFaction" @select="selectedFaction = $event" />
    <ConfigFactionEditor v-if="selectedFaction" :key="selectedFaction" :faction-id="selectedFaction" @saved="selectedFaction = $event" />
    <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ConfigFactionList from '@/app/components/config/ConfigFactionList.vue';
import ConfigFactionEditor from '@/app/components/config/ConfigFactionEditor.vue';

const selectedFaction = ref('');
</script>
