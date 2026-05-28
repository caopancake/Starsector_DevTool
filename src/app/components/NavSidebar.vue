<template>
  <aside class="nav-pane">
    <div class="nav-section nav-workspace-links">
      <button
        type="button"
        class="nav-button"
        :class="{ active: workspace.currentView === 'overview' }"
        @click="workspace.navigateTo('overview')"
      >
        <span class="nav-text">总览</span>
      </button>
      <button
        type="button"
        class="nav-button"
        :class="{ active: workspace.currentView === 'settings' }"
        @click="workspace.navigateTo('settings')"
      >
        <span class="nav-text">设置</span>
      </button>
      <button
        type="button"
        class="nav-button"
        :class="{ active: workspace.currentView === 'about' }"
        @click="workspace.navigateTo('about')"
      >
        <span class="nav-text">About</span>
      </button>
    </div>

    <div v-if="workspace.hasLoadedMods" class="nav-label">已读取 Mod ({{ workspace.loadedModCount }})</div>
    <div class="mod-tree">
      <ModTreeItem
        v-for="mod in workspace.loadedModList"
        :key="mod.modRoot"
        :mod="mod"
        :is-active="workspace.activeModRoot === mod.modRoot"
        :is-expanded="workspace.expandedMods.has(mod.modRoot)"
        @select="navigation.navigateToModOverview(mod.modRoot)"
        @toggle="workspace.toggleExpanded(mod.modRoot)"
        @switch-tab="onSwitchTab"
        @switch-config="onSwitchConfig"
        @remove="$emit('remove-mod', mod.modRoot)"
      />
    </div>
    <div v-if="!workspace.hasWorkspaceContext" class="nav-empty-hint">打开游戏目录查看 Mod 概览，或直接打开一个 Mod。</div>
  </aside>
</template>

<script setup lang="ts">
import ModTreeItem from '@/app/components/ModTreeItem.vue';
import { useWorkspaceStore } from '@/stores/workspace.store';
import type { ConfigView, TableKey } from '@/shared/types';
import { usePerformanceLogger } from '@/app/composables/use-performance-logger';
import { useWorkspaceNavigationActions } from '@/app/composables/use-workspace-navigation-actions';

defineEmits<{ 'remove-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();
const performanceLogger = usePerformanceLogger();
const navigation = useWorkspaceNavigationActions();

function onSwitchTab(modRoot: string, tab: TableKey) {
  performanceLogger.measure('frontend.table.switchTab', { modRoot, table: tab }, () => {
    navigation.navigateToModTable(modRoot, tab);
  });
}

function onSwitchConfig(modRoot: string, view: ConfigView) {
  navigation.navigateToModConfig(modRoot, view);
}
</script>
