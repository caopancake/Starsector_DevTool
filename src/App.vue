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
                <div class="brand-subtitle">{{ projectName }}</div>
              </div>
            </div>
            <n-button block type="primary" @click="openProject">打开 Mod 目录</n-button>
            <div class="mod-path" :title="data?.modRoot">{{ data?.modRoot || '尚未打开项目' }}</div>
            <n-divider />
            <n-button
              v-for="item in tableKeys"
              :key="item"
              block
              quaternary
              class="nav-button"
              :class="{ active: currentTab === item }"
              @click="switchTab(item)"
            >
              {{ MODULE_LABELS[item] }}
              <span class="nav-count">{{ rowsFor(item).length }}</span>
            </n-button>
          </aside>

          <main class="workspace">
            <header class="topbar">
              <div>
                <div class="view-title">{{ MODULE_LABELS[currentTab] }}</div>
                <div class="view-meta">{{ tableInfo }}</div>
              </div>
              <div class="top-actions">
                <n-input v-model:value="searchText" clearable placeholder="搜索 ID / 名称" style="width: 240px" />
                <n-select
                  v-model:value="currentFaction"
                  :options="factionOptions"
                  placeholder="阵营"
                  style="width: 180px"
                />
                <n-button @click="addNewRow" :disabled="!data">新建</n-button>
                <n-button type="error" ghost @click="deleteSelected" :disabled="!selectedRowId">删除</n-button>
                <n-button @click="revertChanges" :disabled="!hasChanges">撤销修改</n-button>
                <n-button
                  type="primary"
                  :loading="saving"
                  :disabled="!hasChanges"
                  @pointerdown.prevent="saveChanges"
                  @click.prevent
                >保存</n-button>
              </div>
            </header>

            <section v-if="!data" class="empty-state">
              <h1>选择一个 Starsector Mod 目录</h1>
              <p>工具会读取 data、graphics 和 mod_info.json，并在本地原位写回配置文件。</p>
              <n-button type="primary" size="large" @click="openProject">打开目录</n-button>
            </section>

            <section v-else class="content-grid">
              <div class="table-panel">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="action-col">操作</th>
                      <th v-for="col in visibleColumns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, rowIndex) in filteredRows"
                      :key="tableRowKey(row, rowIndex)"
                      :class="{ selected: selectedRowId === rowId(row) }"
                      @click="selectedRowId = rowId(row)"
                    >
                      <td class="row-actions">
                        <n-button v-if="currentTab === 'ships'" size="tiny" @click.stop="openShip(rowId(row))">编辑</n-button>
                        <n-button v-if="currentTab === 'weapons'" size="tiny" @click.stop="openWeapon(rowId(row))">编辑</n-button>
                        <n-button v-if="currentTab === 'weapons'" size="tiny" tertiary @click.stop="openPreview(rowId(row))">预览</n-button>
                      </td>
                      <td
                        v-for="col in visibleColumns"
                        :key="col"
                        :class="{ dirty: isDirty(rowId(row), col) }"
                        @dblclick.stop="startCellEdit(row, col)"
                      >
                        <input
                          v-if="editing?.tab === currentTab && editing?.id === rowId(row) && editing?.col === col"
                          v-model="editing.value"
                          class="cell-input"
                          autofocus
                          @blur="finishCellEdit"
                          @keydown.enter.prevent="finishCellEdit"
                          @keydown.esc.prevent="cancelCellEdit"
                        />
                        <span v-else>{{ cell(row[col]) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="rows.length > 0 && visibleColumns.length === 0" class="table-empty-note">
                  当前表有 {{ rows.length }} 行，但没有可显示列。请检查 CSV 表头。
                </div>
                <div v-else-if="rows.length > 0 && filteredRows.length === 0" class="table-empty-note">
                  当前表有 {{ rows.length }} 行，但被搜索或阵营过滤隐藏。
                </div>
              </div>

              <aside class="detail-pane">
                <div class="pane-title">当前记录</div>
                <template v-if="selectedRow">
                  <div class="detail-id">{{ rowId(selectedRow) }}</div>
                  <div class="detail-name">{{ cell(selectedRow.name) || cell(selectedRow.hullName) }}</div>
                  <div class="detail-actions">
                    <n-button v-if="currentTab === 'ships'" block @click="openShip(rowId(selectedRow))">舰船编辑器</n-button>
                    <n-button v-if="currentTab === 'weapons'" block @click="openWeapon(rowId(selectedRow))">武器编辑器</n-button>
                    <n-button v-if="currentTab === 'weapons'" block tertiary @click="openPreview(rowId(selectedRow))">弹道预览</n-button>
                  </div>
                  <div class="kv-list">
                    <div v-for="col in visibleColumns.slice(0, 12)" :key="col" class="kv-row">
                      <span>{{ col }}</span>
                      <strong>{{ cell(selectedRow[col]) }}</strong>
                    </div>
                  </div>
                </template>
                <div v-else class="muted">点击一行查看详情，双击单元格编辑。</div>
              </aside>
            </section>
          </main>
        </div>

        <ShipEditor
          v-if="data && shipEditorId"
          :mod-root="data.modRoot"
          :hull-id="shipEditorId"
          :ship="data.shipFiles[shipEditorId]"
          :sprite-data="data.shipSprites[shipEditorId]"
          :available-sprites="data.availableSprites"
          @close="shipEditorId = ''"
          @saved="onShipSaved"
        />
        <WeaponEditor
          v-if="data && weaponEditorId"
          :mod-root="data.modRoot"
          :weapon-id="weaponEditorId"
          :weapon="weaponForEditor"
          :csv-row="weaponCsvRow"
          :projectiles="data.projFiles"
          @close="weaponEditorId = ''"
          @saved="onWeaponSaved"
          @edit-projectile="openProjectile"
          @preview="openPreview"
        />
        <ProjectileEditor
          v-if="data && projectileEditorId"
          :mod-root="data.modRoot"
          :projectile-id="projectileEditorId"
          :projectile="data.projFiles[projectileEditorId]"
          @close="projectileEditorId = ''"
          @saved="onProjectileSaved"
        />
        <BallisticPreview
          v-if="data && previewWeaponId"
          :weapon-id="previewWeaponId"
          :weapons="tables.weapons"
          :wpn-files="data.wpnFiles"
          :proj-files="data.projFiles"
          @close="previewWeaponId = ''"
        />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { createDiscreteApi, darkTheme, type GlobalThemeOverrides } from 'naive-ui';
import { open } from '@tauri-apps/plugin-dialog';
import ShipEditor from './components/ShipEditor.vue';
import WeaponEditor from './components/WeaponEditor.vue';
import ProjectileEditor from './components/ProjectileEditor.vue';
import BallisticPreview from './components/BallisticPreview.vue';
import { addCsvRow, deleteCsvRow, deleteShip, loadModData, saveCsv, saveShip } from './api';
import type { AppData, RowData, TableKey } from './types';
import { cell, deepClone, defaultShip, defaultWeapon, getColumns, MODULE_LABELS, rowId } from './utils';

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { theme: darkTheme },
});

const data = ref<AppData | null>(null);
const tables = reactive<Record<TableKey, RowData[]>>({ ships: [], weapons: [], wings: [], hullmods: [], industries: [] });
const originalTables = reactive<Record<TableKey, RowData[]>>({ ships: [], weapons: [], wings: [], hullmods: [], industries: [] });
const tableKeys: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'industries'];
const currentTab = ref<TableKey>('ships');
const currentFaction = ref('all');
const searchText = ref('');
const selectedRowId = ref('');
const dirty = reactive<Record<TableKey, Record<string, Record<string, string>>>>({ ships: {}, weapons: {}, wings: {}, hullmods: {}, industries: {} });
const editing = ref<{ tab: TableKey; id: string; col: string; value: string } | null>(null);
const shipEditorId = ref('');
const weaponEditorId = ref('');
const projectileEditorId = ref('');
const previewWeaponId = ref('');
const saving = ref(false);

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#f59e0b',
    primaryColorHover: '#fbbf24',
    primaryColorPressed: '#d97706',
    bodyColor: '#08111f',
    cardColor: '#101827',
  },
};

const projectName = computed(() => cell(data.value?.modInfo?.name) || 'Native Config Tool');
const rows = computed(() => rowsFor(currentTab.value));
const visibleColumns = computed(() => {
  const headerColumns = getColumns(currentTab.value, data.value?.csvHeaders[currentTab.value] || []);
  if (headerColumns.length > 0) return headerColumns;

  const seen = new Set<string>();
  const inferred: string[] = [];
  for (const row of rows.value.slice(0, 50)) {
    for (const key of Object.keys(row)) {
      if (!key.startsWith('_') && !seen.has(key)) {
        seen.add(key);
        inferred.push(key);
      }
    }
  }
  return inferred;
});
const factionOptions = computed(() => {
  const base = [{ label: '全部阵营', value: 'all' }];
  if (!data.value) return base;
  return base.concat(Object.entries(data.value.factionMeta).map(([value, meta]) => ({ label: meta.name, value })));
});
const filteredRows = computed(() => {
  const q = searchText.value.trim().toLowerCase();
  let list = [...rows.value];
  if (currentFaction.value !== 'all' && (currentTab.value === 'ships' || currentTab.value === 'weapons')) {
    list = list.filter((r) => cell(r._faction) === currentFaction.value);
  }
  if (q) {
    list = list.filter((r) => (cell(r.id) + ' ' + cell(r.name)).toLowerCase().includes(q));
  }
  return list;
});
const selectedRow = computed(() => rows.value.find((r) => rowId(r) === selectedRowId.value));
const tableInfo = computed(() => data.value ? `显示 ${filteredRows.value.length} / ${rows.value.length} 行` : '未打开项目');
const hasDirtyChanges = computed(() => tableKeys.some((key) => Object.keys(dirty[key]).length > 0));
const hasChanges = computed(() => hasDirtyChanges.value || editing.value !== null);
const weaponCsvRow = computed(() => tables.weapons.find((w) => rowId(w) === weaponEditorId.value));
const weaponForEditor = computed(() => {
  if (!data.value || !weaponEditorId.value) return {};
  return data.value.wpnFiles[weaponEditorId.value] || defaultWeapon(weaponEditorId.value, weaponCsvRow.value);
});

function rowsFor(tab: TableKey): RowData[] {
  return tables[tab];
}

function tableRowKey(row: RowData, index: number): string {
  const id = rowId(row);
  return `${currentTab.value}:${id || 'row'}:${index}`;
}

function setRowsFor(tab: TableKey, rowsValue: RowData[]) {
  tables[tab] = rowsValue;
}

function switchTab(tab: TableKey) {
  if (editing.value) finishCellEdit();
  currentTab.value = tab;
  selectedRowId.value = '';
  searchText.value = '';
  currentFaction.value = 'all';
}

async function openProject() {
  try {
    const picked = await open({ directory: true, multiple: false, title: '选择 Starsector Mod 根目录' });
    if (!picked || Array.isArray(picked)) return;
    const loaded = await loadModData(picked);
    data.value = loaded;
    for (const key of tableKeys) {
      tables[key] = deepClone(loaded[key] as RowData[]);
      originalTables[key] = deepClone(tables[key]);
      dirty[key] = {};
    }
    currentTab.value = 'ships';
    currentFaction.value = 'all';
    searchText.value = '';
    selectedRowId.value = '';
    message.success('项目已打开');
  } catch (err) {
    message.error(String(err));
  }
}

function isDirty(id: string, col: string): boolean {
  return dirty[currentTab.value][id]?.[col] !== undefined;
}

function startCellEdit(row: RowData, col: string) {
  editing.value = { tab: currentTab.value, id: rowId(row), col, value: cell(row[col]) };
  nextTick(() => document.querySelector<HTMLInputElement>('.cell-input')?.focus());
}

function finishCellEdit() {
  if (!editing.value) return;
  const { tab, id, col, value } = editing.value;
  const row = rowsFor(tab).find((r) => rowId(r) === id);
  if (!row) {
    editing.value = null;
    return;
  }
  row[col] = value;
  const original = originalTables[tab].find((r) => rowId(r) === id);
  const originalValue = cell(original?.[col]);
  if (value !== originalValue) {
    dirty[tab][id] ||= {};
    dirty[tab][id][col] = value;
  } else if (dirty[tab][id]) {
    delete dirty[tab][id][col];
    if (Object.keys(dirty[tab][id]).length === 0) delete dirty[tab][id];
  }
  editing.value = null;
}

function cancelCellEdit() {
  editing.value = null;
}

async function saveChanges() {
  if (!data.value || saving.value) return;
  saving.value = true;
  try {
    if (editing.value) finishCellEdit();
    if (!hasDirtyChanges.value) {
      message.info('没有需要保存的修改');
      return;
    }
    for (const key of tableKeys) {
      if (Object.keys(dirty[key]).length === 0) continue;
      await saveCsv(data.value.modRoot, key, data.value.csvHeaders[key], rowsFor(key));
      originalTables[key] = deepClone(rowsFor(key));
      dirty[key] = {};
    }
    message.success('已保存 CSV 修改');
  } catch (err) {
    message.error(`保存失败：${String(err)}`);
  } finally {
    saving.value = false;
  }
}

function revertChanges() {
  if (!data.value) return;
  editing.value = null;
  for (const key of tableKeys) {
    setRowsFor(key, deepClone(originalTables[key]));
    dirty[key] = {};
  }
  message.success('已撤销未保存修改');
}

async function addNewRow() {
  if (!data.value) return;
  const tab = currentTab.value;
  const id = `new_${tab}_${Date.now()}`;
  const header = data.value.csvHeaders[tab];
  const row: RowData = {};
  for (const col of header) row[col] = '';
  if ('id' in row) row.id = id;
  if ('name' in row) row.name = id;
  row._faction = 'other';
  rowsFor(tab).push(row);
  originalTables[tab].push(deepClone(row));
  await addCsvRow(data.value.modRoot, tab, header, row);
  if (tab === 'ships') {
    const ship = defaultShip(id);
    data.value.shipFiles[id] = ship;
    await saveShip(data.value.modRoot, id, ship);
  }
  selectedRowId.value = id;
  message.success(`已新建 ${id}`);
}

function deleteSelected() {
  if (!data.value || !selectedRowId.value) return;
  const tab = currentTab.value;
  const id = selectedRowId.value;
  dialog.warning({
    title: '确认删除',
    content: `删除 ${id}？此操作会立即写入文件。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      setRowsFor(tab, rowsFor(tab).filter((r) => rowId(r) !== id));
      originalTables[tab] = originalTables[tab].filter((r) => rowId(r) !== id);
      delete dirty[tab][id];
      await deleteCsvRow(data.value!.modRoot, tab, id);
      if (tab === 'ships') {
        delete data.value!.shipFiles[id];
        delete data.value!.shipSprites[id];
        await deleteShip(data.value!.modRoot, id);
      }
      selectedRowId.value = '';
      message.success('已删除');
    },
  });
}

function openShip(id: string) {
  if (!data.value?.shipFiles[id]) {
    message.error(`找不到 ${id}.ship`);
    return;
  }
  shipEditorId.value = id;
}

function openWeapon(id: string) {
  weaponEditorId.value = id;
}

function openProjectile(id: string) {
  if (!id) {
    message.error('请先设置 projectileSpecId');
    return;
  }
  projectileEditorId.value = id;
}

function openPreview(id: string) {
  previewWeaponId.value = id;
}

function onShipSaved(id: string, ship: RowData) {
  if (!data.value) return;
  data.value.shipFiles[id] = deepClone(ship);
  message.success(`${id}.ship 已保存`);
}

function onWeaponSaved(id: string, weapon: RowData) {
  if (!data.value) return;
  data.value.wpnFiles[id] = deepClone(weapon);
  message.success(`${id}.wpn 已保存`);
}

function onProjectileSaved(id: string, projectile: RowData) {
  if (!data.value) return;
  data.value.projFiles[id] = deepClone(projectile);
  message.success(`${id}.proj 已保存`);
}
</script>