<template>
  <div class="overview-page">
    <header class="overview-header">
      <div class="overview-header-row">
        <h1>工作区总览</h1>
        <n-button v-if="workspace.hasWorkspaceContext" size="small" @click="$emit('import-mod')">导入 Mod</n-button>
      </div>
      <p class="overview-subtitle">{{ subtitle }}</p>
    </header>

    <GameOverviewPanel
      v-if="workspace.gameOverview"
      :overview="workspace.gameOverview"
      @import-mod="$emit('import-mod')"
      @load-mod="$emit('load-mod', $event)"
    />

    <section v-else-if="!workspace.hasWorkspaceContext" class="empty-state">
      <h1>选择一个 Starsector/Mod 目录</h1>
      <p>可以打开游戏目录，也可以直接打开一个 Mod 目录。</p>
      <n-button type="primary" size="large" @click="$emit('import-mod')">打开目录</n-button>
    </section>

    <LoadedModsPanel v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GameOverviewPanel from '@/app/components/GameOverviewPanel.vue';
import LoadedModsPanel from '@/app/components/LoadedModsPanel.vue';
import { useWorkspaceStore } from '@/stores/workspace.store';

defineEmits<{ 'import-mod': []; 'load-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();

const subtitle = computed(() => {
  if (workspace.gameOverview) return `${workspace.gameOverview.mods.length} 个 Mod 可用，${workspace.loadedModCount} 个已完整读取`;
  return `${workspace.loadedModCount} 个 Mod 已导入`;
});
</script>
