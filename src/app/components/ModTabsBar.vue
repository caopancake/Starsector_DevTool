<template>
  <nav class="mod-tabs-bar" aria-label="已打开 Mod">
    <div class="mod-tabs-list" role="tablist">
      <div
        v-for="mod in workspace.loadedModList"
        :key="mod.modRoot"
        class="mod-tab"
        :class="{ active: workspace.isModView && workspace.activeModRoot === mod.modRoot }"
        :title="mod.modRoot"
      >
        <button
          class="mod-tab-activate"
          role="tab"
          type="button"
          :aria-selected="workspace.isModView && workspace.activeModRoot === mod.modRoot"
          @click="navigation.activateModTab(mod.modRoot)"
        >
          <span class="mod-tab-name">{{ mod.displayName }}</span>
          <span v-if="hasDirtyChanges(mod.modRoot)" class="mod-tab-dirty" title="有未保存修改" />
          <span v-else class="mod-tab-status" :class="mod.status" :title="statusLabel(mod.status)" />
          <span v-if="mod.status === 'error' && mod.error" class="mod-tab-error-label" :title="mod.error"> 读取失败 </span>
        </button>
        <button class="mod-tab-close" type="button" title="从工作区移除" @click.stop="$emit('remove-mod', mod.modRoot)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
        </button>
      </div>
    </div>

    <button
      class="mod-tabs-overview"
      :class="{ active: workspace.currentView === 'overview' }"
      type="button"
      title="打开工作区总览"
      aria-label="打开工作区总览"
      @click="navigation.showOverview()"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useWorkspaceNavigationActions } from '@/app/composables/use-workspace-navigation-actions';
import { useDraftSessionsStore } from '@/stores/draft-sessions.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';

defineEmits<{ 'remove-mod': [modRoot: string] }>();

const workspace = useWorkspaceStore();
const tables = useTablesStore();
const draftSessions = useDraftSessionsStore();
const navigation = useWorkspaceNavigationActions();

function hasDirtyChanges(modRoot: string): boolean {
  return tables.hasModDirtyChanges(modRoot) || draftSessions.hasDirtyDraftForMod(modRoot);
}

function statusLabel(status: 'loading' | 'ready' | 'error'): string {
  if (status === 'loading') return '正在读取';
  if (status === 'ready') return '已读取';
  return '读取失败';
}
</script>
