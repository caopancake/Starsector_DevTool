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
              <div class="table-panel">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th v-for="col in tables.visibleColumns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, rowIndex) in tables.filteredRows"
                      :key="tables.tableRowKey(row, rowIndex)"
                      :class="{ selected: tables.selectedRowKey === tables.rowSelectionKey(row) }"
                      @click="tables.selectRow(row)"
                    >
                      <td
                        v-for="col in tables.visibleColumns"
                        :key="col"
                        :class="{ dirty: tables.isDirty(rowId(row), col) }"
                        @dblclick.stop="startCellEdit(row, col)"
                      >
                        <input
                          v-if="
                            tables.editing?.tab === tables.currentTab && tables.editing?.id === rowId(row) && tables.editing?.col === col
                          "
                          v-model="tables.editing.value"
                          class="cell-input"
                          autofocus
                          @blur="tables.finishCellEdit"
                          @keydown.enter.prevent="tables.finishCellEdit"
                          @keydown.esc.prevent="tables.cancelCellEdit"
                        />
                        <span v-else>{{ cell(row[col]) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="tables.rows.length > 0 && tables.visibleColumns.length === 0" class="table-empty-note">
                  当前表有 {{ tables.rows.length }} 行，但没有可显示列。请检查 CSV 表头。
                </div>
                <div v-else-if="tables.rows.length > 0 && tables.filteredRows.length === 0" class="table-empty-note">
                  当前表有 {{ tables.rows.length }} 行，但被搜索或阵营过滤隐藏。
                </div>
              </div>

              <aside class="detail-pane">
                <div class="pane-title">当前记录</div>
                <template v-if="tables.selectedRow">
                  <div class="detail-id">{{ rowId(tables.selectedRow) }}</div>
                  <div class="detail-name">{{ cell(tables.selectedRow.name) || cell(tables.selectedRow.hullName) }}</div>
                  <div class="detail-actions">
                    <n-button v-if="tables.currentTab === 'ships'" block @click="openShip(rowId(tables.selectedRow))">舰船编辑器</n-button>
                    <n-button v-if="tables.currentTab === 'weapons'" block @click="editors.openWeapon(rowId(tables.selectedRow))"
                      >武器编辑器</n-button
                    >
                    <n-button v-if="tables.currentTab === 'weapons'" block tertiary @click="editors.openPreview(rowId(tables.selectedRow))"
                      >弹道预览</n-button
                    >
                  </div>
                  <div class="kv-list">
                    <div v-for="col in tables.visibleColumns.slice(0, 12)" :key="col" class="kv-row">
                      <span>{{ col }}</span>
                      <strong>{{ cell(tables.selectedRow[col]) }}</strong>
                    </div>
                  </div>
                </template>
                <div v-else class="muted">点击一行查看详情，双击单元格编辑。</div>
              </aside>
            </section>
          </main>
        </div>

        <ShipEditor
          v-if="project.data && editors.shipEditorId"
          :mod-root="project.data.modRoot"
          :hull-id="editors.shipEditorId"
          :ship="project.data.shipFiles[editors.shipEditorId]"
          :sprite-data="project.data.shipSprites[editors.shipEditorId]"
          :available-sprites="project.data.availableSprites"
          @close="editors.closeShip"
          @saved="onShipSaved"
        />
        <WeaponEditor
          v-if="project.data && editors.weaponEditorId"
          :mod-root="project.data.modRoot"
          :weapon-id="editors.weaponEditorId"
          :weapon="editors.weaponForEditor(project.data, tables.tables.weapons)"
          :csv-row="tables.tables.weapons.find((weapon) => rowId(weapon) === editors.weaponEditorId)"
          :projectiles="project.data.projFiles"
          @close="editors.closeWeapon"
          @saved="onWeaponSaved"
          @edit-projectile="editors.openProjectile"
          @preview="editors.openPreview"
        />
        <ProjectileEditor
          v-if="project.data && editors.projectileEditorId"
          :mod-root="project.data.modRoot"
          :projectile-id="editors.projectileEditorId"
          :projectile="project.data.projFiles[editors.projectileEditorId]"
          @close="editors.closeProjectile"
          @saved="onProjectileSaved"
        />
        <BallisticPreview
          v-if="project.data && editors.previewWeaponId"
          :weapon-id="editors.previewWeaponId"
          :weapons="tables.tables.weapons"
          :wpn-files="project.data.wpnFiles"
          :proj-files="project.data.projFiles"
          @close="editors.closePreview"
        />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { createDiscreteApi, darkTheme, type GlobalThemeOverrides } from 'naive-ui';
import ShipEditor from '../features/editors/components/ShipEditor.vue';
import WeaponEditor from '../features/editors/components/WeaponEditor.vue';
import ProjectileEditor from '../features/editors/components/ProjectileEditor.vue';
import BallisticPreview from '../features/editors/components/BallisticPreview.vue';
import { useEditorsStore } from '../features/editors/editors.store';
import { useProjectStore } from '../features/project/project.store';
import { MODULE_LABELS, TABLE_KEYS, useTablesStore } from '../features/tables/tables.store';
import type { RowData } from '../shared/types';
import { cell, rowId } from '../shared/lib/starsector';

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

function startCellEdit(row: RowData, col: string) {
  tables.startCellEdit(row, col);
  nextTick(() => document.querySelector<HTMLInputElement>('.cell-input')?.focus());
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

function onShipSaved(id: string, ship: RowData) {
  editors.onShipSaved(project.data, id, ship);
  message.success(`${id}.ship 已保存`);
}

function onWeaponSaved(id: string, weapon: RowData) {
  editors.onWeaponSaved(project.data, id, weapon);
  message.success(`${id}.wpn 已保存`);
}

function onProjectileSaved(id: string, projectile: RowData) {
  editors.onProjectileSaved(project.data, id, projectile);
  message.success(`${id}.proj 已保存`);
}
</script>
