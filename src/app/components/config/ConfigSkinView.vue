<template>
  <div class="skin-view">
    <ConfigSkinList :selected-id="selectedSkinId" @select="selectedSkinId = $event" />
    <ConfigSkinEditor v-if="selectedSkinId" :key="selectedSkinId" :skin-hull-id="selectedSkinId" @saved="selectedSkinId = $event" />
    <div v-else class="config-placeholder">
      <p>选择一个舰船皮肤以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ConfigSkinEditor from '@/app/components/config/ConfigSkinEditor.vue';
import ConfigSkinList from '@/app/components/config/ConfigSkinList.vue';

const selectedSkinId = ref('');
</script>
