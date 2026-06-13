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
import { onUnmounted, watchEffect } from 'vue';
import TitleBar from '@/app/TitleBar.vue';
import NavSidebar from '@/app/components/NavSidebar.vue';
import OverviewPage from '@/app/components/OverviewPage.vue';
import SettingsPage from '@/app/components/SettingsPage.vue';
import AboutPage from '@/app/components/AboutPage.vue';
import TableWorkspace from '@/app/components/TableWorkspace.vue';
import ConfigWorkspace from '@/app/components/config/ConfigWorkspace.vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useWorkspaceShellActions } from '@/app/composables/use-workspace-shell-actions';
import { useMainWindowShortcuts } from '@/app/composables/use-main-window-shortcuts';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { registerActiveSaveHandler, unregisterActiveSaveHandler } from '@/shared/lib/save-command-registry';

const project = useProjectStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const feedback = useAppFeedback();
const actions = useWorkspaceShellActions(feedback);
useMainWindowShortcuts(feedback);

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
  if (currentSaveHandler) {
    unregisterActiveSaveHandler(currentSaveHandler);
    currentSaveHandler = null;
  }
});
</script>
