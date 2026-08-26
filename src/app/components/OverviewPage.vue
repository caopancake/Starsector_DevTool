<template>
  <div class="overview-page" :class="{ 'overview-page-empty': !workspace.hasWorkspaceContext && !workspace.hasModOpeningFailures }">
    <header v-if="workspace.hasWorkspaceContext || workspace.hasModOpeningFailures" class="overview-header">
      <div>
        <h1>工作区总览</h1>
        <p class="overview-subtitle">{{ subtitle }}</p>
      </div>
      <n-button v-if="!workspace.gameOverview" size="small" type="primary" @click="beginCreateMod">创建新 Mod</n-button>
    </header>

    <GameOverviewPanel
      v-if="workspace.gameOverview"
      :overview="workspace.gameOverview"
      :opening-failures="workspace.modOpeningFailureList"
      @create-mod="beginCreateMod"
      @refresh-workspace="$emit('refresh-workspace')"
      @close-workspace="$emit('close-workspace')"
      @edit-warning-file="$emit('edit-warning-file', $event)"
      @edit-failure-file="$emit('edit-failure-file', $event)"
      @load-mod="$emit('load-mod', $event)"
    />

    <div v-else class="overview-page-content">
      <ModOpeningFailureList :failures="workspace.modOpeningFailureList" @edit-failure-file="$emit('edit-failure-file', $event)" />

      <section v-if="!workspace.hasWorkspaceContext" class="overview-empty-state empty-state">
        <h1>选择一个 Starsector / Mod 目录</h1>
        <p>可以打开游戏目录，也可以直接打开一个 Mod 目录。</p>
        <div class="overview-empty-actions">
          <n-button type="primary" size="large" @click="beginCreateMod">创建新 Mod</n-button>
          <n-button size="large" @click="$emit('import-mod')">打开目录</n-button>
        </div>
      </section>

      <LoadedModsPanel v-else />
    </div>

    <n-modal
      v-model:show="createModVisible"
      preset="dialog"
      title="创建新 Mod"
      positive-text="创建并打开"
      negative-text="取消"
      :positive-button-props="{ loading: createModSaving }"
      @positive-click="submitCreateMod"
    >
      <div class="create-mod-dialog">
        <p class="create-mod-target">目标目录：{{ createModDestinationText }}</p>
        <p class="create-mod-hint">将创建 `mod_info.json` 与标准空目录；不会预置 CSV 或 spec 文件。</p>
        <label class="create-mod-field">
          <span>Mod ID</span>
          <n-input v-model:value="createModTemplate.id" autofocus placeholder="英文标识，例如 example_mod" />
        </label>
        <label class="create-mod-field">
          <span>名称</span>
          <n-input v-model:value="createModTemplate.name" placeholder="显示名称" />
        </label>
        <label class="create-mod-field">
          <span>版本号</span>
          <n-input v-model:value="createModTemplate.version" />
        </label>
        <label class="create-mod-field">
          <span>适用游戏版本</span>
          <n-input v-model:value="createModTemplate.gameVersion" />
        </label>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GameOverviewPanel from '@/app/components/GameOverviewPanel.vue';
import LoadedModsPanel from '@/app/components/LoadedModsPanel.vue';
import ModOpeningFailureList from '@/app/components/ModOpeningFailureList.vue';
import { useCreateModViewModel } from '@/app/composables/use-create-mod-view-model';
import { useWorkspaceStore } from '@/stores/workspace.store';
import type { GameScanWarning, ModOpeningFailure } from '@/shared/types';

defineEmits<{
  'import-mod': [];
  'refresh-workspace': [];
  'close-workspace': [];
  'edit-warning-file': [warning: GameScanWarning];
  'edit-failure-file': [failure: ModOpeningFailure];
  'load-mod': [modRoot: string];
}>();

const workspace = useWorkspaceStore();
const {
  beginCreateMod,
  destinationText: createModDestinationText,
  saving: createModSaving,
  submitCreateMod,
  template: createModTemplate,
  visible: createModVisible,
} = useCreateModViewModel();

const subtitle = computed(() => {
  if (workspace.gameOverview) return `${workspace.gameOverview.mods.length} 个 Mod 可用，当前仅显示游戏目录概览`;
  if (workspace.hasLoadedMods) return `${workspace.loadedModCount} 个 Mod 已打开`;
  if (workspace.hasModOpeningFailures) return `${workspace.modOpeningFailureList.length} 个 Mod 打开失败`;
  return '尚未打开工作区';
});
</script>
