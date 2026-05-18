<template>
  <div class="config-factions-layout">
    <FactionEntityList :selected-id="selectedFaction" @select="selectedFaction = $event" />
    <FactionEditor v-if="selectedFaction" :key="selectedFaction" :faction-id="selectedFaction" @saved="selectedFaction = $event" />
    <div v-else class="config-placeholder"><p>选择一个势力以编辑</p></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FactionEntityList from './FactionEntityList.vue';
import FactionEditor from './FactionEditor.vue';

const selectedFaction = ref('');
</script>
