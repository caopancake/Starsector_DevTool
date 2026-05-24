<template>
  <div class="overview-page" :class="{ 'overview-page-empty': !workspace.hasWorkspaceContext }">
    <header v-if="workspace.hasWorkspaceContext" class="overview-header">
      <h1>工作区总览</h1>
      <p class="overview-subtitle">{{ subtitle }}</p>
    </header>

    <GameOverviewPanel
      v-if="workspace.gameOverview"
      :overview="workspace.gameOverview"
      @refresh-workspace="$emit('refresh-workspace')"
      @close-workspace="$emit('close-workspace')"
      @load-mod="$emit('load-mod', $event)"
    />

    <section v-if="!workspace.hasWorkspaceContext" class="overview-empty-state empty-state">
      <h1>选择一个 Starsector / Mod 目录</h1>
      <p>可以打开游戏目录，也可以直接打开一个 Mod 目录。</p>
      <n-button type="primary" size="large" @click="$emit('import-mod')">打开目录</n-button>
    </section>

    <LoadedModsPanel v-if="workspace.hasWorkspaceContext && !workspace.gameOverview" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GameOverviewPanel from '@/app/components/GameOverviewPanel.vue';
import LoadedModsPanel from '@/app/components/LoadedModsPanel.vue';
import { useWorkspaceStore } from '@/stores/workspace.store';

defineEmits<{ 'import-mod': []; 'refresh-workspace': []; 'close-workspace': []; 'load-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();

const subtitle = computed(() => {
  if (workspace.gameOverview) return `${workspace.gameOverview.mods.length} 个 Mod 可用，当前仅显示游戏目录概览`;
  if (workspace.hasLoadedMods) return `${workspace.loadedModCount} 个 Mod 已打开`;
  return '尚未打开工作区';
});
</script>
