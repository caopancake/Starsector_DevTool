<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-frame" :data-theme="settings.theme">
          <TitleBar />
          <div class="app-shell">
            <NavSidebar @remove-mod="confirmRemoveMod" />

            <OverviewPage v-if="workspace.currentView === 'overview'" @import-mod="openDirectory" @load-mod="loadOverviewMod" />
            <SettingsPage v-else-if="workspace.currentView === 'settings'" />
            <TableWorkspace
              v-else-if="workspace.currentView === 'table' && project.activeModData"
              @add-row="addNewRow"
              @delete-row="confirmDelete"
              @revert="revertChanges"
              @save="saveChanges"
              @open-ship="openShip"
            />
            <ConfigWorkspace v-else-if="workspace.currentView === 'config' && project.activeModData" />
            <main v-else class="workspace">
              <section class="empty-state">
                <h1>选择一个 Starsector 目录</h1>
                <p>可以打开游戏目录查看 Mod 概览，也可以直接打开一个 Mod 目录。</p>
                <n-button type="primary" size="large" @click="openDirectory">打开目录</n-button>
              </section>
            </main>
          </div>
        </div>

        <EditorsHost />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, h, onMounted, watch } from 'vue';
import { NButton, NSpace, NText, createDiscreteApi } from 'naive-ui';
import EditorsHost from './EditorsHost.vue';
import TitleBar from './TitleBar.vue';
import NavSidebar from './components/NavSidebar.vue';
import OverviewPage from './components/OverviewPage.vue';
import SettingsPage from './components/SettingsPage.vue';
import TableWorkspace from './components/TableWorkspace.vue';
import ConfigWorkspace from '../features/config/components/ConfigWorkspace.vue';
import { useSettingsStore } from './settings.store';
import { useEditorsStore } from '../features/editors/editors.store';
import { useHistoryStore } from '../features/history/history.store';
import { useGlobalShortcuts } from '../features/history/composables/useGlobalShortcuts';
import { useProjectStore } from '../features/project/project.store';
import { useTablesStore } from '../features/tables/tables.store';
import { useWorkspaceStore } from '../features/workspace/workspace.store';
import { useCoreSchema } from '../features/schema/composables/useCoreSchema';
import { pickDirectory } from '../features/project/project.service';
import { loadWorkspace, saveWorkspace } from '../shared/api/tauri';
import { cell, formatModVersion } from '../shared/lib/starsector';
import { extractFileReferenceFromError, formatError } from '../shared/lib/errors';
import { loadModFromOverview, openDetectedDirectory, restoreWorkspaceMod } from '../features/workspace/open-directory.service';
import { openFileEditorWindow } from '../features/workspace/file-editor-window';
import { buildThemeOverrides, discreteConfigProviderProps } from './theme-overrides';

const project = useProjectStore();
const tables = useTablesStore();
const editors = useEditorsStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const historyStore = useHistoryStore();
const { loadCoreFields } = useCoreSchema();

useGlobalShortcuts();

const themeOverrides = computed(() => buildThemeOverrides(settings));

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

// Sync workspace active Mod → project/tables/editors stores
watch(
  () => workspace.activeModRoot,
  (modRoot) => {
    project.setActiveModRoot(modRoot);
    const appData = modRoot ? project.getModData(modRoot) : null;
    tables.activateFor(modRoot ?? '', appData);
    editors.activateFor(modRoot ?? '');
    historyStore.activateFor(modRoot ?? '');
  },
);

// Auto-save workspace state (debounced, skipped during restore)
let saveTimer: number | null = null;
let restoring = false;
watch(
  () => workspace.toPersistedState(),
  (state) => {
    if (restoring) return;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveWorkspace(state), 500);
  },
  { deep: true },
);

// Startup: restore persisted workspace
// Startup: restore persisted workspace
onMounted(async () => {
  try {
    const persisted = await loadWorkspace();
    if (persisted.mods.length === 0 && !persisted.starsectorRoot) return;
    restoring = true;
    workspace.restoreFrom(persisted);

    // Hydrate all mods (this no longer sets activeRoot)
    for (const mod of persisted.mods) {
      try {
        const loaded = await restoreWorkspaceMod(mod, persisted.starsectorRoot ?? settings.starsectorRoot);
        const name = cell(loaded.modInfo?.name) || mod.displayName;
        const version = formatModVersion(loaded.modInfo?.version) || mod.version;
        workspace.updateModInfo(mod.modRoot, name, version);
        workspace.updateModStatus(mod.modRoot, 'ready');
      } catch (err) {
        removeMod(mod.modRoot, false);
        showError(`恢复 ${mod.displayName || mod.modRoot} 失败: ${formatError(err)}`, err);
      }
    }

    // Only after all hydrations complete, activate the previously active mod
    if (persisted.activeModRoot && workspace.isModImported(persisted.activeModRoot)) {
      const activeMod = workspace.mods.get(persisted.activeModRoot);
      if (activeMod?.status === 'ready') {
        workspace.setActiveMod(persisted.activeModRoot);
      }
    }
    restoring = false;
    loadCoreFields();
  } catch {
    restoring = false;
  }
});

async function openDirectory() {
  try {
    const selected = await pickDirectory();
    if (!selected) return;
    const outcome = await openDetectedDirectory(selected, settings.starsectorRoot || null);
    handleOpenOutcome(outcome);
  } catch (err) {
    showError(formatError(err), err);
  }
}

async function loadOverviewMod(modRoot: string) {
  try {
    const outcome = await loadModFromOverview(modRoot);
    handleOpenOutcome(outcome);
  } catch (err) {
    showError(formatError(err), err);
  }
}

function handleOpenOutcome(outcome: { type: string; modName?: string; availableModCount?: number; message?: string }) {
  if (outcome.type === 'game-overview') {
    if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
    message.success(`已扫描游戏目录: ${outcome.availableModCount ?? 0} 个 Mod`);
  } else if (outcome.type === 'mod-loaded') {
    if (workspace.gameOverview?.starsectorRoot) settings.setStarsectorRoot(workspace.gameOverview.starsectorRoot);
    message.success(`已导入: ${outcome.modName ?? 'Mod'}`);
  } else if (outcome.type === 'already-loaded') {
    message.info('该 Mod 已在工作区中');
  } else {
    message.error(outcome.message ?? '未识别该目录');
  }
}

function confirmRemoveMod(modRoot: string) {
  if (tables.hasModDirtyChanges(modRoot)) {
    dialog.warning({
      title: '移除 Mod',
      content: '该 Mod 有未保存修改，移除后修改将丢失。确认移除？',
      positiveText: '移除',
      negativeText: '取消',
      onPositiveClick: () => removeMod(modRoot),
    });
  } else {
    removeMod(modRoot);
  }
}

function removeMod(modRoot: string, showMessage = true) {
  workspace.removeMod(modRoot);
  tables.removeModState(modRoot);
  editors.removeModState(modRoot);
  historyStore.removeModState(modRoot);
  project.removeModData(modRoot);
  if (showMessage) message.success('已从工作区移除');
}

async function saveChanges() {
  try {
    const result = await tables.saveChanges(project.activeModData);
    message[result === 'saved' ? 'success' : 'info'](result === 'saved' ? '已保存 CSV 修改' : '没有需要保存的修改');
  } catch (err) {
    showError(formatError(err), err);
  }
}

function revertChanges() {
  tables.revertChanges();
  message.success('已撤销未保存修改');
}

async function addNewRow() {
  if (!project.activeModData) return;
  try {
    await tables.addNewRow(project.activeModData);
    message.success(`已新建 ${tables.selectedRowId}`);
  } catch (err) {
    showError(formatError(err), err);
  }
}

function confirmDelete() {
  if (!project.activeModData || !tables.selectedRowId) return;
  const id = tables.selectedRowId;
  dialog.error({
    title: '确认删除',
    content: `删除 ${id}？此操作会立即写入文件。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tables.deleteSelected(project.activeModData!);
        message.success('已删除');
      } catch (err) {
        showError(formatError(err), err);
      }
    },
  });
}

function openShip(id: string) {
  if (!project.activeModData?.shipFiles[id]) {
    message.error(`找不到 ${id}.ship`);
    return;
  }
  editors.openShip(id);
}

function showError(text: string, error: unknown = text) {
  const reference = extractFileReferenceFromError(error) ?? extractFileReferenceFromError(text);
  if (!reference) {
    message.error(text);
    return;
  }
  message.error(
    () =>
      h(
        NSpace,
        { align: 'center', wrap: false },
        {
          default: () => [
            h(NText, { type: 'error', style: { maxWidth: '680px', overflowWrap: 'anywhere' } }, { default: () => text }),
            h(
              NButton,
              {
                size: 'tiny',
                type: 'error',
                secondary: true,
                onClick: () =>
                  void openFileEditorWindow({
                    path: reference.path,
                    line: reference.line,
                    title: '文件编辑器',
                    contextLabel: '错误',
                    message: reference.message,
                  }),
              },
              { default: () => '打开错误文件' },
            ),
          ],
        },
      ),
    { duration: 10000, closable: true },
  );
}
</script>
