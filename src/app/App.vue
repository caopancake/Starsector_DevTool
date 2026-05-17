<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-frame" :data-theme="settings.theme">
          <TitleBar />
          <div class="app-shell">
            <NavSidebar :loading="project.loading" @import-mod="importMod" @remove-mod="confirmRemoveMod" />

            <OverviewPage v-if="workspace.currentView === 'overview'" @import-mod="importMod" />
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
                <h1>选择一个 Starsector Mod 目录</h1>
                <p>工具会读取 data、graphics 和 mod_info.json，并在本地原位写回配置文件。</p>
                <n-button type="primary" size="large" @click="importMod">打开 Mod 目录</n-button>
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
import { computed, onMounted, watch } from 'vue';
import { createDiscreteApi, type GlobalThemeOverrides } from 'naive-ui';
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
import { pickModRoot } from '../features/project/project.service';
import { loadWorkspace, saveWorkspace } from '../shared/api/tauri';
import { cell, formatModVersion } from '../shared/lib/starsector';
import { formatError } from '../shared/lib/errors';

const project = useProjectStore();
const tables = useTablesStore();
const editors = useEditorsStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const historyStore = useHistoryStore();
const { loadCoreFields } = useCoreSchema();

useGlobalShortcuts();

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: settings.activeAccentHex,
    primaryColorHover: cssVar('--color-primary-hover', settings.activeAccentHex),
    primaryColorPressed: cssVar('--color-primary-pressed', settings.activeAccentHex),
    primaryColorSuppl: settings.activeAccentHex,
  },
  Button: {
    borderRadiusSmall: '5px',
  },
  Switch: {
    railColorActive: settings.activeAccentHex,
  },
}));

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

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
    if (persisted.mods.length === 0) return;
    restoring = true;
    workspace.restoreFrom(persisted);

    // Hydrate all mods (this no longer sets activeRoot)
    for (const mod of persisted.mods) {
      try {
        const loaded = await project.openProject(mod.modRoot);
        const name = cell(loaded.modInfo?.name) || mod.displayName;
        const version = formatModVersion(loaded.modInfo?.version) || mod.version;
        workspace.updateModInfo(mod.modRoot, name, version);
        workspace.updateModStatus(mod.modRoot, 'ready');
        tables.hydrateWithoutActivate(mod.modRoot, loaded);
      } catch (err) {
        workspace.updateModStatus(mod.modRoot, 'error', formatError(err));
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

async function importMod() {
  try {
    const modRoot = await pickModRoot();
    if (!modRoot) return;

    // Guard: already imported → just activate
    if (workspace.isModImported(modRoot)) {
      workspace.setActiveMod(modRoot);
      message.info('该 Mod 已在工作区中');
      return;
    }

    // Register as loading
    workspace.registerMod({
      modRoot,
      displayName: modRoot.split(/[\\/]/).pop() || 'Mod',
      version: '',
      status: 'loading',
    });
    workspace.setActiveMod(modRoot);

    // Load data
    const loaded = await project.openProject(modRoot);

    // Update entry info from loaded data
    const displayName = cell(loaded.modInfo?.name) || modRoot.split(/[\\/]/).pop() || 'Mod';
    const version = formatModVersion(loaded.modInfo?.version) || '';
    workspace.updateModInfo(modRoot, displayName, version);
    workspace.updateModStatus(modRoot, 'ready');

    // Hydrate tables
    tables.hydrate(modRoot, loaded);
    editors.activateFor(modRoot);
    historyStore.activateFor(modRoot);

    message.success(`已导入: ${displayName}`);
  } catch (err) {
    const modRoot = workspace.activeModRoot;
    if (modRoot && workspace.isModImported(modRoot)) {
      workspace.updateModStatus(modRoot, 'error', formatError(err));
    }
    message.error(formatError(err));
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

function removeMod(modRoot: string) {
  workspace.removeMod(modRoot);
  tables.removeModState(modRoot);
  editors.removeModState(modRoot);
  historyStore.removeModState(modRoot);
  project.removeModData(modRoot);
  message.success('已从工作区移除');
}

async function saveChanges() {
  try {
    const result = await tables.saveChanges(project.activeModData);
    message[result === 'saved' ? 'success' : 'info'](result === 'saved' ? '已保存 CSV 修改' : '没有需要保存的修改');
  } catch (err) {
    message.error(formatError(err));
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
    message.error(formatError(err));
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
        message.error(formatError(err));
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
</script>
