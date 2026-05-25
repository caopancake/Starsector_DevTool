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
      <template v-for="(section, sectionIndex) in moduleSections" :key="section.id">
        <div v-if="sectionIndex > 0" class="mod-tree-separator" />
        <button
          v-for="item in section.items"
          :key="item.id"
          class="mod-tree-module-btn"
          :class="{ 'module-active': isActive && isModuleActive(item) }"
          @click="switchModule(item)"
        >
          <span>{{ item.label }}</span>
          <span v-if="item.count !== null" class="mod-tree-module-count">{{ item.count }}</span>
        </button>
      </template>
    </div>

    <div v-if="isExpanded && mod.status === 'loading'" class="mod-tree-status">加载中…</div>
    <div v-if="isExpanded && mod.status === 'error'" class="mod-tree-status mod-tree-error">{{ mod.error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ConfigView, ModEntry, TableKey } from '@/shared/types';
import { useTablesStore } from '@/stores/tables.store';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { buildModTreeModuleSections, isModTreeModuleActive, type ModTreeModuleItem } from '@/domain/workspace/mod-tree';

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

const hasDirtyChanges = computed(() => tables.hasModDirtyChanges(props.mod.modRoot));
const manifest = computed(() => project.getManifest(props.mod.modRoot));
const moduleSections = computed(() => buildModTreeModuleSections(manifest.value));

function isModuleActive(item: ModTreeModuleItem): boolean {
  return isModTreeModuleActive(item, workspace.currentView, workspace.configView, tables.currentTab);
}

function switchModule(item: ModTreeModuleItem) {
  if (item.target.type === 'config') {
    emit('switch-config', props.mod.modRoot, item.target.view);
    return;
  }
  emit('switch-tab', props.mod.modRoot, item.target.table);
}

function onRemove() {
  showMenu.value = false;
  emit('remove');
}
</script>
