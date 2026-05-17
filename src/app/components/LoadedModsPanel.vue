<template>
  <section class="overview-grid">
    <div
      v-for="mod in workspace.loadedModList"
      :key="mod.modRoot"
      class="overview-mod-card"
      :class="{ 'card-active': workspace.activeModRoot === mod.modRoot }"
      @click="workspace.setActiveMod(mod.modRoot)"
    >
      <div class="mod-card-header">
        <strong>{{ mod.displayName }}</strong>
        <span class="mod-card-status" :class="mod.status">{{ statusLabel(mod.status) }}</span>
      </div>
      <div class="mod-card-version">{{ mod.version || '未声明版本' }}</div>
      <div class="mod-card-path">{{ mod.modRoot }}</div>
      <div v-if="tables.hasModDirtyChanges(mod.modRoot)" class="mod-card-dirty">有未保存修改</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTablesStore } from '../../features/tables/tables.store';
import { useWorkspaceStore } from '../../features/workspace/workspace.store';

const workspace = useWorkspaceStore();
const tables = useTablesStore();

function statusLabel(status: string): string {
  if (status === 'ready') return '已加载';
  if (status === 'loading') return '加载中';
  return '错误';
}
</script>
