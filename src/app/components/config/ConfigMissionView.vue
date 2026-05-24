<template>
  <div class="mission-view">
    <ConfigMissionList
      :selected-id="selectedMission"
      :refresh-token="refreshToken"
      :mission-rows="missionRows"
      :mission-icons="missionIcons"
      :mod-root="modRoot"
      :session-id="sessionId"
      :query-missions="queryMissions"
      :create-mission="createMission"
      :delete-mission="deleteMission"
      @select="selectedMission = $event"
    />
    <ConfigMissionEditor
      v-if="selectedMission"
      :key="selectedMission"
      :mission-id="selectedMission"
      :mod-root="modRoot"
      :session-id="sessionId"
      :query-mission="queryMission"
      :query-mission-icon="queryMissionIcon"
      :save-mission="saveMission"
      :delete-mission="deleteMission"
      @saved="handleSaved"
    />
    <div v-else class="config-placeholder">
      <p>选择一个战役以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConfigMissionList from '@/app/components/config/ConfigMissionList.vue';
import ConfigMissionEditor from '@/app/components/config/ConfigMissionEditor.vue';
import { useConfigMissionViewModel } from '@/app/composables/use-config-mission-view-model';

const {
  selectedMission,
  refreshToken,
  missionRows,
  missionIcons,
  modRoot,
  sessionId,
  handleSaved,
  createMission,
  deleteMission,
  queryMissions,
  queryMission,
  queryMissionIcon,
  saveMission,
} = useConfigMissionViewModel();
</script>
