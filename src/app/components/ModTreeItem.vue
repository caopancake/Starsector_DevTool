<template>
  <div class="mod-tree-item" :class="{ active: isActive, expanded: isExpanded && mod.status === 'ready' }">
    <div class="mod-tree-header" @click="$emit('select')">
      <button class="mod-tree-chevron" :class="{ expanded: isExpanded }" @click.stop="$emit('toggle')">
        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
      </button>
      <div class="mod-tree-name" :title="mod.modRoot">{{ mod.displayName }}</div>
      <span v-if="hasDirtyChanges" class="mod-tree-dirty-dot" title="有未保存修改" />
      <button class="mod-tree-menu" title="更多操作" @click.stop="showMenu = !showMenu">⋯</button>
      <div v-if="showMenu" class="mod-tree-dropdown" @mouseleave="showMenu = false">
        <button @click="onRemove">从工作区移除</button>
      </div>
    </div>

    <div v-if="isExpanded && mod.status === 'ready'" class="mod-tree-modules">
      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'mod-overview' }"
        @click="$emit('switch-config', mod.modRoot, 'mod-overview')"
      >
        <span>Mod 概览</span>
      </button>
      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'file-history' }"
        @click="$emit('switch-config', mod.modRoot, 'file-history')"
      >
        <span>文件历史</span>
      </button>

      <div class="mod-tree-separator" />

      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'mod-info' }"
        @click="$emit('switch-config', mod.modRoot, 'mod-info')"
      >
        <span>Mod 信息</span>
      </button>

      <div class="mod-tree-separator" />

      <button
        v-for="key in primaryTableKeys"
        :key="key"
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'table' && tables.currentTab === key }"
        @click="$emit('switch-tab', mod.modRoot, key)"
      >
        <span>{{ MODULE_LABELS[key] }}</span>
        <span class="mod-tree-module-count">{{ getRowCount(key) }}</span>
      </button>
      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'skins' }"
        @click="$emit('switch-config', mod.modRoot, 'skins')"
      >
        <span>舰船皮肤</span>
        <span class="mod-tree-module-count">{{ skinCount }}</span>
      </button>
      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'variants' }"
        @click="$emit('switch-config', mod.modRoot, 'variants')"
      >
        <span>装配</span>
        <span class="mod-tree-module-count">{{ variantCount }}</span>
      </button>

      <div class="mod-tree-separator" />

      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'factions' }"
        @click="$emit('switch-config', mod.modRoot, 'factions')"
      >
        <span>势力</span>
        <span class="mod-tree-module-count">{{ factionCount }}</span>
      </button>
      <button
        v-for="key in secondaryTableKeys"
        :key="key"
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'table' && tables.currentTab === key }"
        @click="$emit('switch-tab', mod.modRoot, key)"
      >
        <span>{{ MODULE_LABELS[key] }}</span>
        <span class="mod-tree-module-count">{{ getRowCount(key) }}</span>
      </button>
      <button
        class="mod-tree-module-btn"
        :class="{ 'module-active': isActive && workspace.currentView === 'config' && workspace.configView === 'mission' }"
        @click="$emit('switch-config', mod.modRoot, 'mission')"
      >
        <span>战役</span>
        <span class="mod-tree-module-count">{{ missionCount }}</span>
      </button>
    </div>

    <div v-if="isExpanded && mod.status === 'loading'" class="mod-tree-status">加载中…</div>
    <div v-if="isExpanded && mod.status === 'error'" class="mod-tree-status mod-tree-error">{{ mod.error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ConfigView, ModEntry, TableKey } from '@/shared/types';
import { MODULE_LABELS } from '@/shared/lib/starsector';
import { useTablesStore } from '@/stores/tables.store';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';

const props = defineProps<{ mod: ModEntry; isActive: boolean; isExpanded: boolean }>();
const emit = defineEmits<{
  select: [];
  toggle: [];
  'switch-tab': [modRoot: string, tab: TableKey];
  'switch-config': [modRoot: string, view: ConfigView];
  remove: [];
}>();

const tables = useTablesStore();
const project = useProjectStore();
const workspace = useWorkspaceStore();
const showMenu = ref(false);
const primaryTableKeys: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'shipSystems'];
const secondaryTableKeys: TableKey[] = ['industries', 'skills'];

const hasDirtyChanges = computed(() => tables.hasModDirtyChanges(props.mod.modRoot));
const factionCount = computed(() => {
  const data = project.getModData(props.mod.modRoot);
  return data?.factionFiles ? Object.keys(data.factionFiles).length : 0;
});
const missionCount = computed(() => project.getModData(props.mod.modRoot)?.missionCount ?? 0);
const skinCount = computed(() => project.getModData(props.mod.modRoot)?.skinFiles.length ?? 0);
const variantCount = computed(() => project.getModData(props.mod.modRoot)?.variantFiles.length ?? 0);

function getRowCount(key: TableKey): number {
  return project.getModData(props.mod.modRoot)?.[key]?.length ?? 0;
}

function onRemove() {
  showMenu.value = false;
  emit('remove');
}
</script>
