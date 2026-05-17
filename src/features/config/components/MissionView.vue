<template>
  <div class="mission-view">
    <aside class="mission-file-list config-entity-list">
      <header class="mission-file-list-header config-entity-list-header">
        <h3>战役列表</h3>
      </header>
      <ul class="mission-file-items config-entity-list-items">
        <li v-if="missions.length === 0" class="mission-file-empty config-entity-list-empty">
          未找到 data/missions/mission_list.csv 或其中没有战役。
        </li>
        <li
          v-for="mission in missions"
          :key="mission.id"
          class="mission-file-item config-entity-list-item"
          :class="{ active: mission.index === selectedMissionIndex }"
          @click="selectMission(mission.index)"
        >
          <span class="mission-icon-thumb config-entity-thumb">
            <img v-if="missionIcon(mission.id)" :src="missionIcon(mission.id)" alt="" />
          </span>
          <span class="mission-file-name config-entity-name">{{ mission.id }}</span>
          <n-button
            size="tiny"
            quaternary
            class="mission-delete-btn config-entity-delete compact-icon-button"
            title="删除战役"
            @click.stop="confirmDeleteMission(mission)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </n-button>
        </li>
      </ul>
      <footer class="mission-file-list-footer config-entity-list-footer">
        <n-button size="small" block @click="createMission">新建战役</n-button>
      </footer>

      <n-modal
        v-model:show="showCreateDialog"
        preset="dialog"
        title="新建战役"
        positive-text="创建"
        negative-text="取消"
        @positive-click="doCreateMission"
      >
        <n-input v-model:value="newMissionId" placeholder="输入战役 ID（英文目录名）" autofocus />
      </n-modal>

      <n-modal
        v-model:show="showDeleteDialog"
        preset="dialog"
        title="确认删除"
        positive-text="删除"
        negative-text="取消"
        type="error"
        @positive-click="confirmDeleteSelectedMission"
      >
        <p>确定要从战役列表中删除 "{{ pendingDeleteMission?.id }}" 吗？</p>
        <n-checkbox v-model:checked="deleteMissionDirectory">同时删除战役目录</n-checkbox>
      </n-modal>
    </aside>
    <main v-if="tableData && selectedMission && schema" class="mission-editor">
      <header class="mission-editor-header">
        <h3>{{ missionId(selectedMission) }}</h3>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存战役</n-button>
      </header>
      <div class="mission-editor-body">
        <div v-if="iconSrc" class="mission-icon-preview">
          <img :src="iconSrc" alt="" />
        </div>
        <SchemaFormRenderer :schema="schema" v-model="localMission" :app-data="project.activeModData" />
      </div>
    </main>
    <div v-else class="config-placeholder">
      <p>选择一个战役以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useSettingsStore } from '../../../app/settings.store';
import { loadImageDataUrl } from '../../../shared/api/tauri';
import { formatError } from '../../../shared/lib/errors';
import type { CsvTable } from '../../../shared/api/tauri';
import type { JsonValue, RowData } from '../../../shared/types';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { aggregateSchemaSources, getSchema, splitSchemaSources } from '../../schema/schema.service';
import {
  deleteMissionDirectory as deleteMissionDirectoryData,
  loadMissionData,
  loadMissionListData,
  saveMissionData,
  saveMissionListData,
  scanMissionListFiles,
} from '../config.service';

const project = useProjectStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const DEFAULT_MISSION_LIST_PATH = 'data/missions/mission_list.csv';

const missionListPath = ref<string | null>(null);
const selectedMissionIndex = ref<number | null>(null);
const tableData = ref<CsvTable | null>(null);
const descriptor = ref<RowData>({});
const missionText = ref('');
const localMission = ref<RowData>({});
const iconSrc = ref('');
const saving = ref(false);
const missionIcons = ref<Record<string, string>>({});
const showCreateDialog = ref(false);
const newMissionId = ref('');
const showDeleteDialog = ref(false);
const deleteMissionDirectory = ref(false);
const pendingDeleteMission = ref<{ id: string; index: number } | null>(null);

const modRoot = computed(() => project.activeModData?.modRoot ?? null);
const schema = computed(() => getSchema('mission'));
const missions = computed(() =>
  (tableData.value?.rows ?? []).map((row, index) => ({ id: missionId(row), index })).filter((mission) => mission.id.length > 0),
);
const selectedMission = computed(() => {
  if (!tableData.value || selectedMissionIndex.value === null) return null;
  return tableData.value.rows[selectedMissionIndex.value] ?? null;
});
function cellValue(value: JsonValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function missionId(row: RowData): string {
  return cellValue(row.mission).trim();
}

function missionIcon(id: string): string {
  return missionIcons.value[id] ?? '';
}

async function loadFileList() {
  if (!modRoot.value) {
    missionListPath.value = null;
    tableData.value = null;
    return;
  }
  try {
    const files = await scanMissionListFiles(modRoot.value);
    missionListPath.value = files[0] ?? DEFAULT_MISSION_LIST_PATH;
    tableData.value = files[0]
      ? await loadMissionListData(modRoot.value, missionListPath.value)
      : {
          header: ['mission'],
          path: DEFAULT_MISSION_LIST_PATH,
          rows: [],
        };
    syncMissionCount();
    await loadMissionIcons();
    await selectMission(missions.value[0]?.index ?? null);
  } catch (error) {
    message.error(formatError(error));
    missionListPath.value = DEFAULT_MISSION_LIST_PATH;
    tableData.value = null;
  }
}

async function loadMissionIcons() {
  const root = modRoot.value;
  if (!root) {
    missionIcons.value = {};
    return;
  }
  const coreRoot = settings.starsectorRoot || project.activeModData?.starsectorRoot || undefined;
  const icons: Record<string, string> = {};
  await Promise.all(
    missions.value.map(async (mission) => {
      try {
        const data = await loadMissionData(root, mission.id);
        if (!data.iconPath) return;
        icons[mission.id] = (await loadImageDataUrl(root, data.iconPath, coreRoot)) ?? '';
      } catch {
        icons[mission.id] = '';
      }
    }),
  );
  missionIcons.value = icons;
}

async function selectMission(index: number | null) {
  selectedMissionIndex.value = index;
  descriptor.value = {};
  missionText.value = '';
  localMission.value = {};
  iconSrc.value = '';
  if (index === null || !modRoot.value || !tableData.value) return;
  const row = tableData.value.rows[index];
  const id = missionId(row);
  if (!id) return;
  try {
    const data = await loadMissionData(modRoot.value, id);
    descriptor.value = data.descriptor;
    missionText.value = data.text;
    localMission.value = aggregateSchemaSources({
      list: row,
      descriptor: data.descriptor,
      text: data.text,
    });
    if (data.iconPath) {
      const coreRoot = settings.starsectorRoot || project.activeModData?.starsectorRoot || undefined;
      iconSrc.value = (await loadImageDataUrl(modRoot.value, data.iconPath, coreRoot)) ?? '';
    }
  } catch (error) {
    message.error(formatError(error));
  }
}

async function save() {
  if (!modRoot.value || !missionListPath.value || !tableData.value || !selectedMission.value || !schema.value) return;
  const split = splitSchemaSources(localMission.value, schema.value);
  const list = split.list && typeof split.list === 'object' && !Array.isArray(split.list) ? (split.list as RowData) : {};
  const descriptorSource =
    split.descriptor && typeof split.descriptor === 'object' && !Array.isArray(split.descriptor) ? (split.descriptor as RowData) : {};
  const textSource = String(split.text ?? '');
  const id = missionId(list);
  if (!id) {
    message.warning('mission 不能为空');
    return;
  }
  selectedMission.value.mission = id;
  for (const [key, value] of Object.entries(list)) {
    selectedMission.value[key] = value as JsonValue;
    if (!tableData.value.header.includes(key)) tableData.value.header.push(key);
  }
  saving.value = true;
  try {
    await saveMissionListData(modRoot.value, missionListPath.value, tableData.value.header, tableData.value.rows);
    await saveMissionData(modRoot.value, id, descriptorSource, textSource);
    descriptor.value = descriptorSource;
    missionText.value = textSource;
    await loadMissionIcons();
    message.success(`${id} 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

function createMission() {
  newMissionId.value = '';
  showCreateDialog.value = true;
}

async function doCreateMission() {
  const id = newMissionId.value.trim();
  if (!id) {
    message.warning('战役 ID 不能为空');
    return false;
  }
  if (!isValidMissionId(id)) {
    message.error('战役 ID 不能包含路径分隔符或 ..');
    return false;
  }
  if (missions.value.some((mission) => mission.id === id)) {
    message.warning(`战役 "${id}" 已存在`);
    return false;
  }
  if (!modRoot.value) return false;

  ensureMissionTable();
  if (!tableData.value || !missionListPath.value) return false;

  const row: RowData = {};
  for (const col of tableData.value.header) {
    row[col] = col === 'mission' ? id : '';
  }
  tableData.value.rows.push(row);

  try {
    await saveMissionListData(modRoot.value, missionListPath.value, tableData.value.header, tableData.value.rows);
    await saveMissionData(modRoot.value, id, { title: id }, '');
    syncMissionCount();
    message.success(`战役 "${id}" 已创建`);
    showCreateDialog.value = false;
    await loadMissionIcons();
    await selectMission(tableData.value.rows.length - 1);
  } catch (error) {
    tableData.value.rows.pop();
    message.error(formatError(error));
    return false;
  }
  return true;
}

function confirmDeleteMission(mission: { id: string; index: number }) {
  pendingDeleteMission.value = mission;
  deleteMissionDirectory.value = false;
  showDeleteDialog.value = true;
}

async function confirmDeleteSelectedMission() {
  if (!pendingDeleteMission.value) return false;
  await deleteMissionRow(pendingDeleteMission.value, deleteMissionDirectory.value);
  pendingDeleteMission.value = null;
  return true;
}

async function deleteMissionRow(mission: { id: string; index: number }, deleteDirectory: boolean) {
  if (!modRoot.value || !missionListPath.value || !tableData.value) return;
  const removed = tableData.value.rows.splice(mission.index, 1);
  const previousSelected = selectedMissionIndex.value;
  try {
    await saveMissionListData(modRoot.value, missionListPath.value, tableData.value.header, tableData.value.rows);
    if (deleteDirectory) await deleteMissionDirectoryData(modRoot.value, mission.id);
    syncMissionCount();
    const nextMission = missions.value[Math.min(mission.index, missions.value.length - 1)] ?? null;
    delete missionIcons.value[mission.id];
    await selectMission(nextMission?.index ?? null);
    message.success(`战役 "${mission.id}" 已从列表删除`);
  } catch (error) {
    tableData.value.rows.splice(mission.index, 0, ...removed);
    selectedMissionIndex.value = previousSelected;
    message.error(formatError(error));
  }
}

function syncMissionCount() {
  const data = project.activeModData;
  if (!data) return;
  data.missionCount = missions.value.length;
}

function ensureMissionTable() {
  if (!missionListPath.value) missionListPath.value = DEFAULT_MISSION_LIST_PATH;
  if (!tableData.value) {
    tableData.value = {
      header: ['mission'],
      path: missionListPath.value,
      rows: [],
    };
  }
  if (!tableData.value.header.includes('mission')) {
    tableData.value.header = ['mission', ...tableData.value.header];
  }
}

function isValidMissionId(id: string): boolean {
  return id.length > 0 && !id.includes('/') && !id.includes('\\') && id !== '.' && id !== '..' && !id.includes('..');
}

onMounted(() => {
  loadFileList();
});

watch(modRoot, () => {
  missionListPath.value = null;
  selectedMissionIndex.value = null;
  tableData.value = null;
  descriptor.value = {};
  missionText.value = '';
  localMission.value = {};
  iconSrc.value = '';
  missionIcons.value = {};
  loadFileList();
});
</script>
