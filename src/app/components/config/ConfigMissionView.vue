<template>
  <div class="mission-view">
    <ConfigMissionList
      :selected-id="selectedMission"
      :refresh-token="refreshToken"
      :missions="missionItems"
      :mission-icons="missionIcons"
      :refresh-mission-list="refreshMissionList"
      :create-mission="createMission"
      :delete-mission="deleteMission"
      :mission-exists="missionExists"
      :is-valid-mission-id="isValidMissionId"
      @select="selectedMission = $event"
    />
    <ConfigMissionEditor
      v-if="selectedMission"
      :key="selectedMission"
      :mission-id="selectedMission"
      :mod-root="modRoot"
      :session-id="sessionId"
      :query-mission-editor-data="queryMissionEditorData"
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
  missionItems,
  missionIcons,
  modRoot,
  sessionId,
  handleSaved,
  createMission,
  deleteMission,
  refreshMissionList,
  queryMissionEditorData,
  missionExists,
  isValidMissionId,
  saveMission,
} = useConfigMissionViewModel();
</script>
