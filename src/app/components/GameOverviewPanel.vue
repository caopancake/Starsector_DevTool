<template>
  <section class="game-overview">
    <div class="game-overview-summary">
      <div class="game-overview-title">
        <strong>{{ overview.starsectorRoot }}</strong>
        <span>{{ overview.coreAvailable ? '原版数据可用' : '原版数据不可用' }}</span>
      </div>
      <div class="game-overview-actions">
        <n-button size="small" @click="$emit('refresh-workspace')">刷新工作区</n-button>
        <n-button size="small" secondary type="error" @click="$emit('close-workspace')">关闭工作区</n-button>
      </div>
    </div>

    <div v-if="overview.warnings.length > 0" class="game-warning-list">
      <div v-for="warning in overview.warnings" :key="`${warning.path}:${warning.message}`" class="game-warning-item">
        <strong>{{ warning.message }}</strong>
        <span>{{ warning.path }}</span>
      </div>
    </div>

    <div v-if="overview.mods.length === 0" class="game-overview-empty">
      <h2>没有发现可识别 Mod</h2>
      <p>已打开游戏目录，但 `mods` 目录下没有包含 `mod_info.json` 的 Mod。</p>
      <div class="game-overview-actions">
        <n-button size="small" @click="$emit('refresh-workspace')">刷新工作区</n-button>
        <n-button size="small" secondary type="error" @click="$emit('close-workspace')">关闭工作区</n-button>
      </div>
    </div>

    <div v-else class="overview-grid">
      <div
        v-for="mod in overview.mods"
        :key="mod.modRoot"
        class="overview-mod-card"
        :class="{ 'card-active': workspace.activeModRoot === mod.modRoot }"
      >
        <div class="mod-card-header">
          <strong>{{ mod.name }}</strong>
          <span class="mod-card-status" :class="modStatus(mod.modRoot)">{{ modStatusLabel(mod.modRoot) }}</span>
        </div>
        <div class="mod-card-version">{{ mod.version || '未声明版本' }}</div>
        <div class="mod-card-path">{{ mod.modRoot }}</div>
        <div v-if="mod.description" class="mod-card-description">{{ mod.description }}</div>
        <div class="mod-card-actions">
          <n-button v-if="workspace.isModImported(mod.modRoot)" size="small" @click="workspace.setActiveMod(mod.modRoot)"
            >进入编辑</n-button
          >
          <n-button v-else size="small" type="primary" @click="$emit('load-mod', mod.modRoot)">完整读取</n-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { GameOverviewData } from '@/shared/types';
import { useWorkspaceStore } from '@/stores/workspace.store';

defineProps<{ overview: GameOverviewData }>();
defineEmits<{ 'refresh-workspace': []; 'close-workspace': []; 'load-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();

function statusLabel(status: string): string {
  if (status === 'ready') return '已加载';
  if (status === 'loading') return '加载中';
  return '错误';
}

function modStatus(modRoot: string): string {
  return workspace.mods.get(modRoot)?.status ?? 'pending';
}

function modStatusLabel(modRoot: string): string {
  const status = workspace.mods.get(modRoot)?.status;
  if (status) return statusLabel(status);
  return '未读取';
}
</script>
