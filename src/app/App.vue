<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-frame" :data-theme="settings.theme">
          <TitleBar />
          <div class="app-shell">
            <NavSidebar @remove-mod="actions.confirmRemoveMod" />

            <OverviewPage
              v-if="workspace.currentView === 'overview'"
              @import-mod="actions.openDirectory"
              @load-mod="actions.loadOverviewMod"
            />
            <SettingsPage v-else-if="workspace.currentView === 'settings'" />
            <TableWorkspace
              v-else-if="workspace.currentView === 'table' && project.activeModData"
              @add-row="actions.addNewRow"
              @delete-row="actions.deleteSelectedRow"
              @revert="actions.revertChanges"
              @save="actions.saveChanges"
              @detail-action="actions.handleDetailAction"
            />
            <ConfigWorkspace v-else-if="workspace.currentView === 'config' && project.activeModData" />
            <main v-else class="workspace">
              <section class="empty-state">
                <h1>选择一个 Starsector 目录</h1>
                <p>可以打开游戏目录查看 Mod 概览，也可以直接打开一个 Mod 目录。</p>
                <n-button type="primary" size="large" @click="actions.openDirectory">打开目录</n-button>
              </section>
            </main>
          </div>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TitleBar from './TitleBar.vue';
import NavSidebar from './components/NavSidebar.vue';
import OverviewPage from './components/OverviewPage.vue';
import SettingsPage from './components/SettingsPage.vue';
import TableWorkspace from './components/TableWorkspace.vue';
import ConfigWorkspace from '../features/config/components/ConfigWorkspace.vue';
import { useSettingsStore } from './settings-store';
import { useProjectStore } from '../features/project/project-store';
import { useWorkspaceStore } from '../features/workspace/workspace-store';
import { buildThemeOverrides } from './theme-overrides';
import { createAppFeedback } from './app-feedback';
import { useWorkspaceShellActions } from '../features/workspace/workspace-shell-actions';

const project = useProjectStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();

const themeOverrides = computed(() => buildThemeOverrides(settings));
const { message, dialog } = createAppFeedback(['message', 'dialog']);
const actions = useWorkspaceShellActions(message, dialog);
</script>
