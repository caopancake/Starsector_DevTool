<template>
  <div class="overview-page">
    <header class="overview-header">
      <h1>工作区概览</h1>
      <p class="overview-subtitle">{{ workspace.modCount }} 个 Mod 已导入</p>
    </header>

    <section v-if="!workspace.hasAnyMod" class="empty-state">
      <h1>选择一个 Starsector Mod 目录</h1>
      <p>工具会读取 data、graphics 和 mod_info.json，并在本地原位写回配置文件。</p>
      <n-button type="primary" size="large" @click="$emit('import-mod')">打开 Mod 目录</n-button>
    </section>

    <section v-else class="overview-grid">
      <div
        v-for="mod in workspace.modList"
        :key="mod.modRoot"
        class="overview-mod-card"
        :class="{ 'card-active': workspace.activeModRoot === mod.modRoot }"
        @click="workspace.setActiveMod(mod.modRoot)"
      >
        <div class="mod-card-header">
          <strong>{{ mod.displayName }}</strong>
          <span class="mod-card-version" v-if="mod.version">v{{ mod.version }}</span>
          <span class="mod-card-status" :class="mod.status">{{ statusLabel(mod.status) }}</span>
        </div>
        <div class="mod-card-path">{{ mod.modRoot }}</div>
        <div v-if="mod.status === 'ready'" class="mod-card-stats">
          <span v-for="key in TABLE_KEYS" :key="key" class="mod-card-stat">
            {{ MODULE_LABELS[key] }} {{ getRowCount(mod.modRoot, key) }}
          </span>
        </div>
        <div v-if="tables.hasModDirtyChanges(mod.modRoot)" class="mod-card-dirty">有未保存修改</div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '../../features/workspace/workspace.store';
import { useProjectStore } from '../../features/project/project.store';
import { TABLE_KEYS, useTablesStore } from '../../features/tables/tables.store';
import { MODULE_LABELS } from '../../shared/lib/starsector';
import type { TableKey } from '../../shared/types';

defineEmits<{ 'import-mod': [] }>();

const workspace = useWorkspaceStore();
const project = useProjectStore();
const tables = useTablesStore();

function getRowCount(modRoot: string, key: TableKey): number {
  return project.getModData(modRoot)?.[key]?.length ?? 0;
}

function statusLabel(status: string): string {
  if (status === 'ready') return '已加载';
  if (status === 'loading') return '加载中';
  return '错误';
}
</script>
