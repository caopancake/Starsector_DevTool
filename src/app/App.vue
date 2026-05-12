<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-shell">
          <aside class="nav-pane">
            <div class="brand">
              <div class="brand-mark">SD</div>
              <div>
                <div class="brand-title">Starsector DevTool</div>
                <div class="brand-subtitle">{{ project.projectName }}</div>
              </div>
            </div>
            <n-button block type="primary" :loading="project.loading" @click="openProject">打开 Mod 目录</n-button>
            <div class="mod-path" :title="project.data?.modRoot">{{ project.data?.modRoot || '尚未打开项目' }}</div>
            <n-divider />
            <n-button
              v-for="item in TABLE_KEYS"
              :key="item"
              block
              quaternary
              class="nav-button"
              :class="{ active: tables.currentTab === item }"
              @click="tables.switchTab(item, project.data)"
            >
              {{ MODULE_LABELS[item] }}
              <span class="nav-count">{{ tables.rowsFor(item).length }}</span>
            </n-button>
          </aside>

          <main class="workspace">
            <header class="topbar">
              <div>
                <div class="view-title">{{ MODULE_LABELS[tables.currentTab] }}</div>
                <div class="view-meta">{{ project.isOpen ? tables.tableInfo : '未打开项目' }}</div>
              </div>
              <div class="top-actions">
                <n-input v-model:value="tables.searchText" clearable placeholder="搜索 ID / 名称" style="width: 240px" />
                <n-select v-model:value="tables.currentFaction" :options="factionOptions" placeholder="阵营" style="width: 180px" />
                <n-button :disabled="!project.data" @click="addNewRow">新建</n-button>
                <n-button type="error" ghost :disabled="!tables.selectedRowId" @click="confirmDelete">删除</n-button>
                <n-button :disabled="!tables.hasChanges" @click="revertChanges">撤销修改</n-button>
                <n-button
                  type="primary"
                  :loading="tables.saving"
                  :disabled="!tables.hasChanges"
                  @pointerdown.prevent="saveChanges"
                  @click.prevent
                >
                  保存
                </n-button>
              </div>
            </header>

            <section v-if="!project.data" class="empty-state">
              <h1>选择一个 Starsector Mod 目录</h1>
              <p>工具会读取 data、graphics 和 mod_info.json，并在本地原位写回配置文件。</p>
              <n-button type="primary" size="large" @click="openProject">打开目录</n-button>
            </section>

            <section v-else class="content-grid">
              <DataTable />
              <DetailPane @open-ship="openShip" />
            </section>
          </main>
        </div>

        <EditorsHost />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { createDiscreteApi, darkTheme, type GlobalThemeOverrides } from 'naive-ui';
import DataTable from './DataTable.vue';
import DetailPane from './DetailPane.vue';
import EditorsHost from './EditorsHost.vue';
import { useEditorsStore } from '../features/editors/editors.store';
import { useProjectStore } from '../features/project/project.store';
import { MODULE_LABELS, TABLE_KEYS, useTablesStore } from '../features/tables/tables.store';

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { theme: darkTheme },
});

const project = useProjectStore();
const tables = useTablesStore();
const editors = useEditorsStore();

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#f59e0b',
    primaryColorHover: '#fbbf24',
    primaryColorPressed: '#d97706',
    bodyColor: '#08111f',
    cardColor: '#101827',
  },
};

const factionOptions = computed(() => {
  const base = [{ label: '全部阵营', value: 'all' }];
  if (!project.data) return base;
  return base.concat(Object.entries(project.data.factionMeta).map(([value, meta]) => ({ label: meta.name, value })));
});

async function openProject() {
  try {
    const loaded = await project.pickAndOpenProject();
    if (!loaded) return;
    tables.hydrate(loaded);
    message.success('项目已打开');
  } catch (err) {
    message.error(String(err));
  }
}

async function saveChanges() {
  try {
    const result = await tables.saveChanges(project.data);
    message[result === 'saved' ? 'success' : 'info'](result === 'saved' ? '已保存 CSV 修改' : '没有需要保存的修改');
  } catch (err) {
    message.error(`保存失败：${String(err)}`);
  }
}

function revertChanges() {
  tables.revertChanges();
  message.success('已撤销未保存修改');
}

async function addNewRow() {
  if (!project.data) return;
  try {
    await tables.addNewRow(project.data);
    message.success(`已新建 ${tables.selectedRowId}`);
  } catch (err) {
    message.error(`新建失败：${String(err)}`);
  }
}

function confirmDelete() {
  if (!project.data || !tables.selectedRowId) return;
  const id = tables.selectedRowId;
  dialog.warning({
    title: '确认删除',
    content: `删除 ${id}？此操作会立即写入文件。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tables.deleteSelected(project.data!);
        message.success('已删除');
      } catch (err) {
        message.error(`删除失败：${String(err)}`);
      }
    },
  });
}

function openShip(id: string) {
  if (!project.data?.shipFiles[id]) {
    message.error(`找不到 ${id}.ship`);
    return;
  }
  editors.openShip(id);
}
</script>
