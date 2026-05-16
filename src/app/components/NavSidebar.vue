<template>
  <aside class="nav-pane">
    <div class="nav-section">
      <n-button block type="primary" :loading="loading" @click="$emit('import-mod')">打开 Mod 目录</n-button>
    </div>

    <div class="nav-section nav-workspace-links">
      <button class="nav-button" :class="{ active: workspace.currentView === 'overview' }" @click="workspace.navigateTo('overview')">
        <span class="nav-text">概览</span>
      </button>
      <button class="nav-button" :class="{ active: workspace.currentView === 'settings' }" @click="workspace.navigateTo('settings')">
        <span class="nav-text">设置</span>
      </button>
    </div>

    <div v-if="workspace.hasAnyMod" class="nav-label">工作区 ({{ workspace.modCount }})</div>
    <div class="mod-tree">
      <ModTreeItem
        v-for="mod in workspace.modList"
        :key="mod.modRoot"
        :mod="mod"
        :is-active="workspace.activeModRoot === mod.modRoot"
        :is-expanded="workspace.expandedMods.has(mod.modRoot)"
        @select="workspace.setActiveMod(mod.modRoot)"
        @toggle="workspace.toggleExpanded(mod.modRoot)"
        @switch-tab="onSwitchTab"
        @switch-config="onSwitchConfig"
        @remove="$emit('remove-mod', mod.modRoot)"
      />
    </div>
    <div v-if="!workspace.hasAnyMod" class="nav-empty-hint">打开一个 Mod 目录以开始编辑。</div>
  </aside>
</template>

<script setup lang="ts">
import ModTreeItem from './ModTreeItem.vue';
import { useWorkspaceStore } from '../../features/workspace/workspace.store';
import { useTablesStore } from '../../features/tables/tables.store';
import { useProjectStore } from '../../features/project/project.store';
import type { ConfigView, TableKey } from '../../shared/types';

defineProps<{ loading: boolean }>();
defineEmits<{ 'import-mod': []; 'remove-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();
const tables = useTablesStore();
const project = useProjectStore();

function onSwitchTab(modRoot: string, tab: TableKey) {
  workspace.setActiveMod(modRoot);
  const data = project.getModData(modRoot);
  tables.switchTab(tab, data);
}

function onSwitchConfig(modRoot: string, view: ConfigView) {
  workspace.setActiveConfig(modRoot, view);
}
</script>
