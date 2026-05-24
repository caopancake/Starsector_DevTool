<template>
  <div class="skin-view">
    <ConfigSkinList
      :selected-id="selectedSkinId"
      :skins="skins"
      :skin-sprites="skinSprites"
      :hull-options="hullOptions"
      :create-skin="createSkin"
      :delete-skin="deleteSkin"
      @select="selectedSkinId = $event"
    />
    <ConfigSkinEditor
      v-if="selectedSkinId"
      :key="selectedSkinId"
      :skin-hull-id="selectedSkinId"
      :skins="skins"
      :save-skin="saveSkin"
      :delete-skin="deleteSkin"
      @saved="onSaved"
    />
    <div v-else class="config-placeholder">
      <p>选择一个舰船皮肤以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConfigSkinEditor from '@/app/components/config/ConfigSkinEditor.vue';
import ConfigSkinList from '@/app/components/config/ConfigSkinList.vue';
import { useConfigSkinViewModel } from '@/app/composables/use-config-skin-view-model';

const { selectedSkinId, skins, skinSprites, hullOptions, createSkin, deleteSkin, onSaved, saveSkin } = useConfigSkinViewModel();
</script>
