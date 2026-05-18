<template>
  <div class="skin-view">
    <SkinEntityList :selected-id="selectedSkinId" @select="selectedSkinId = $event" />
    <SkinEditor v-if="selectedSkinId" :key="selectedSkinId" :skin-hull-id="selectedSkinId" @saved="selectedSkinId = $event" />
    <div v-else class="config-placeholder">
      <p>选择一个舰船皮肤以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SkinEditor from './SkinEditor.vue';
import SkinEntityList from './SkinEntityList.vue';

const selectedSkinId = ref('');
</script>
