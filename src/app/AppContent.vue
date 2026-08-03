<template>
  <div class="app-frame" :data-theme="settings.theme">
    <TitleBar />
    <div class="app-shell">
      <NavSidebar @remove-mod="actions.confirmRemoveMod" />

      <OverviewPage
        v-if="workspace.currentView === 'overview'"
        @import-mod="actions.openDirectory"
        @refresh-workspace="actions.refreshWorkspace"
        @close-workspace="actions.confirmCloseWorkspace"
        @load-mod="actions.loadOverviewMod"
      />
      <SettingsPage v-else-if="workspace.currentView === 'settings'" />
      <AboutPage v-else-if="workspace.currentView === 'about'" />
      <TableWorkspace
        v-else-if="workspace.currentView === 'table' && project.activeManifest"
        @add-row="actions.addNewRow"
        @delete-row="actions.deleteSelectedRow"
        @redo="actions.redoCurrentTableEdit"
        @save="actions.saveChanges"
        @undo="actions.undoCurrentTableEdit"
        @detail-action="actions.handleDetailAction"
      />
      <ConfigWorkspace v-else-if="workspace.currentView === 'config' && project.activeManifest" />
      <main v-else class="workspace">
        <section class="empty-state">
          <h1>选择一个 Starsector 目录</h1>
          <p>可以打开游戏目录查看 Mod 概览，也可以直接打开一个 Mod 目录。</p>
          <n-button type="primary" size="large" @click="actions.openDirectory">打开目录</n-button>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, watchEffect } from 'vue';
import TitleBar from '@/app/TitleBar.vue';
import NavSidebar from '@/app/components/NavSidebar.vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useWorkspaceShellActions } from '@/app/composables/use-workspace-shell-actions';
import { useMainWindowShortcuts } from '@/app/composables/use-main-window-shortcuts';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useDirtyWindowCloseGuard } from '@/app/composables/use-dirty-window-close-guard';
import { registerActiveSaveHandler, unregisterActiveSaveHandler } from '@/shared/lib/save-command-registry';
import { useTablesStore } from '@/stores/tables.store';
import { useDraftSessionsStore } from '@/stores/draft-sessions.store';

const OverviewPage = defineAsyncComponent(() => import('@/app/components/OverviewPage.vue'));
const SettingsPage = defineAsyncComponent(() => import('@/app/components/SettingsPage.vue'));
const AboutPage = defineAsyncComponent(() => import('@/app/components/AboutPage.vue'));
const TableWorkspace = defineAsyncComponent(() => import('@/app/components/TableWorkspace.vue'));
const ConfigWorkspace = defineAsyncComponent(() => import('@/app/components/config/ConfigWorkspace.vue'));

const project = useProjectStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const tables = useTablesStore();
const draftSessions = useDraftSessionsStore();
const feedback = useAppFeedback();
const actions = useWorkspaceShellActions(feedback);
useMainWindowShortcuts(feedback);
const hasUnsavedMainWindowChanges = computed(() =>
  workspace.loadedModList.some((mod) => tables.hasModDirtyChanges(mod.modRoot) || draftSessions.hasDirtyDraftForMod(mod.modRoot)),
);
const closeGuard = useDirtyWindowCloseGuard({
  content: '主窗口中仍有未保存修改，关闭后这些修改将丢失。',
  dirty: hasUnsavedMainWindowChanges,
  title: '放弃未保存修改并关闭？',
});

let currentSaveHandler: (() => void | Promise<void>) | null = null;

watchEffect(() => {
  if (currentSaveHandler) {
    unregisterActiveSaveHandler(currentSaveHandler);
    currentSaveHandler = null;
  }

  if (workspace.currentView === 'table' && project.activeManifest) {
    currentSaveHandler = actions.saveChanges;
    registerActiveSaveHandler(currentSaveHandler);
  }
});

onUnmounted(() => {
  closeGuard.dispose();
  if (currentSaveHandler) {
    unregisterActiveSaveHandler(currentSaveHandler);
    currentSaveHandler = null;
  }
});

onMounted(() => {
  void closeGuard.install();
});
</script>
