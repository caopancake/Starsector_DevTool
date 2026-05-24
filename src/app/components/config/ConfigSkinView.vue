<template>
  <div class="skin-view">
    <ConfigSkinList :selected-id="selectedSkinId" :skins="skins" @select="selectedSkinId = $event" @changed="loadSkins" />
    <ConfigSkinEditor
      v-if="selectedSkinId"
      :key="selectedSkinId"
      :skin-hull-id="selectedSkinId"
      :skins="skins"
      @saved="selectedSkinId = $event"
      @changed="loadSkins"
    />
    <div v-else class="config-placeholder">
      <p>选择一个舰船皮肤以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ConfigSkinEditor from '@/app/components/config/ConfigSkinEditor.vue';
import ConfigSkinList from '@/app/components/config/ConfigSkinList.vue';
import { listSkinEntities } from '@/services/config.service';
import { useProjectStore } from '@/stores/project.store';
import type { SkinFile } from '@/shared/types';

const selectedSkinId = ref('');
const skins = ref<SkinFile[]>([]);
const project = useProjectStore();

async function loadSkins() {
  const sessionId = project.activeSessionId;
  if (!sessionId) {
    skins.value = [];
    return;
  }
  skins.value = await listSkinEntities(sessionId);
}

watch(() => project.activeSessionId, loadSkins, { immediate: true });
</script>
