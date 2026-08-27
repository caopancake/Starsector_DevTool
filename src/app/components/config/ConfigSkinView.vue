<template>
  <div class="skin-view">
    <ConfigSkinList
      :selected-id="selectedSkinId"
      :skins="skins"
      :skin-sprite-refs="skinSpriteRefs"
      :hull-options="hullOptions"
      :load-hull-options="loadHullOptions"
      :mod-root="modRoot"
      :session-id="sessionId"
      :list-load-started-at="listLoadStartedAt"
      :create-skin="createSkin"
      :delete-skin="deleteSkin"
      @select="selectSkin"
    />
    <ConfigSkinEditor
      v-if="selectedSkinId"
      :key="selectedSkinId"
      :skin-hull-id="selectedSkinId"
      :skins="skins"
      :mod-root="modRoot"
      :session-id="sessionId"
      :data-revision="skinDataRevision"
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
import { useDraftTransitionConfirmation } from '@/app/composables/use-draft-transition-confirmation';
import { useConfigSkinViewModel } from '@/app/composables/use-config-skin-view-model';

const {
  selectedSkinId,
  modRoot,
  sessionId,
  skins,
  skinSpriteRefs,
  hullOptions,
  loadHullOptions,
  skinDataRevision,
  listLoadStartedAt,
  createSkin,
  deleteSkin,
  onSaved,
  saveSkin,
} = useConfigSkinViewModel();
const { confirmDraftTransition } = useDraftTransitionConfirmation();

function selectSkin(skinHullId: string | null): void {
  const nextSkinHullId = skinHullId ?? '';
  if (nextSkinHullId === selectedSkinId.value) return;
  confirmDraftTransition(modRoot.value, {
    title: '切换舰船皮肤？',
    content: '当前舰船皮肤有未保存修改，切换后这些修改将丢失。确认继续？',
    action: () => {
      selectedSkinId.value = nextSkinHullId;
    },
  });
}
</script>
