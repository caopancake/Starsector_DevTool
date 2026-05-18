<template>
  <div class="mission-view">
    <MissionEntityList :selected-id="selectedMission" :refresh-token="refreshToken" @select="selectedMission = $event" />
    <MissionEditor v-if="selectedMission" :key="selectedMission" :mission-id="selectedMission" @saved="handleSaved" />
    <div v-else class="config-placeholder">
      <p>选择一个战役以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MissionEntityList from './MissionEntityList.vue';
import MissionEditor from './MissionEditor.vue';

const selectedMission = ref('');
const refreshToken = ref(0);

function handleSaved(missionId: string) {
  selectedMission.value = missionId;
  refreshToken.value += 1;
}
</script>
