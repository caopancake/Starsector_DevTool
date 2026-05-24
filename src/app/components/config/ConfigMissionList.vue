<template>
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
        :class="{ active: mission.id === selectedId }"
        @click="emit('select', mission.id)"
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
          @click.stop="confirmDeleteMission(mission.id)"
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
  </aside>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NCheckbox } from 'naive-ui';
import { useProjectStore } from '@/stores/project.store';
import type { JsonValue, RowData } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { listMissionEntities } from '@/services/config.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { buildMissionIndexRow } from '@/domain/config/config-entities';
import {
  createIndexedConfigEntityWithFileHistory,
  deleteIndexedConfigEntityWithFileHistory,
} from '@/orchestrators/config-save.orchestrator';

const props = defineProps<{ selectedId: string; refreshToken: number }>();
const emit = defineEmits<{ select: [missionId: string] }>();

const project = useProjectStore();
const feedback = useAppFeedback();

const missionRows = ref<RowData[]>([]);
const missionIcons = ref<Record<string, string>>({});
const showCreateDialog = ref(false);
const newMissionId = ref('');
const deleteMissionDirectory = ref(false);
const pendingDeleteMission = ref('');

const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
const missions = computed(() =>
  missionRows.value
    .map((row) => missionId(row))
    .filter(Boolean)
    .map((id) => ({ id })),
);

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
    missionRows.value = [];
    return;
  }
  try {
    if (!sessionId.value) return;
    const entities = await listMissionEntities(sessionId.value);
    missionRows.value = entities.map((entity) => entity.list);
    syncMissionCount();
    await loadMissionIcons(entities);
    if (!props.selectedId && missions.value[0]) emit('select', missions.value[0].id);
    if (props.selectedId && !missions.value.some((mission) => mission.id === props.selectedId)) emit('select', missions.value[0]?.id ?? '');
  } catch (error) {
    feedback.error(error, '加载战役列表失败');
    missionRows.value = [];
  }
}

async function loadMissionIcons(entities = [] as Awaited<ReturnType<typeof listMissionEntities>>) {
  if (!sessionId.value) {
    missionIcons.value = {};
    return;
  }
  const iconEntities = entities.filter((entity) => entity.iconResourceRef);
  const dataUrls = await queryResourceDataUrlBatch(
    sessionId.value,
    iconEntities.map((entity) => entity.iconResourceRef!),
  );
  missionIcons.value = Object.fromEntries(iconEntities.map((entity, index) => [entity.id, dataUrls[index] ?? '']));
}

function createMission() {
  newMissionId.value = '';
  showCreateDialog.value = true;
}

async function doCreateMission() {
  const id = newMissionId.value.trim();
  if (!id) {
    feedback.warning('战役 ID 不能为空');
    return false;
  }
  if (!isValidMissionId(id)) {
    feedback.error('战役 ID 不能包含路径分隔符或 ..');
    return false;
  }
  if (missions.value.some((mission) => mission.id === id)) {
    feedback.warning(`战役 "${id}" 已存在`);
    return false;
  }
  if (!modRoot.value) return false;
  try {
    const result = await createIndexedConfigEntityWithFileHistory({
      modRoot: modRoot.value,
      kind: 'mission',
      nextId: id,
      indexRow: buildMissionIndexRow([], ['mission'], id),
      payload: { descriptor: { title: id }, text: '' },
    });
    missionRows.value = result.indexRows;
    syncMissionCount();
    feedback.success(`战役 "${id}" 已创建`);
    showCreateDialog.value = false;
    await loadFileList();
    emit('select', id);
  } catch (error) {
    feedback.error(error, '创建战役失败');
    return false;
  }
  return true;
}

function confirmDeleteMission(id: string) {
  pendingDeleteMission.value = id;
  deleteMissionDirectory.value = false;
  feedback.confirmDanger({
    title: '删除战役',
    content: () =>
      h('div', { class: 'associated-save-dialog' }, [
        h('p', `确定要从战役列表中删除 "${id}" 吗？`),
        h(
          NCheckbox,
          {
            checked: deleteMissionDirectory.value,
            'onUpdate:checked': (checked: boolean) => {
              deleteMissionDirectory.value = checked;
            },
          },
          { default: () => '同时删除战役目录' },
        ),
      ]),
    actionText: '删除',
    onConfirm: deletePendingMission,
  });
}

async function deletePendingMission() {
  if (!pendingDeleteMission.value || !modRoot.value) return;
  try {
    const deleted = pendingDeleteMission.value;
    await deleteIndexedConfigEntityWithFileHistory(modRoot.value, 'mission', deleted, deleteMissionDirectory.value);
    await loadFileList();
    delete missionIcons.value[deleted];
    pendingDeleteMission.value = '';
    const nextId = missions.value[0]?.id ?? '';
    if (props.selectedId === deleted) emit('select', nextId);
    feedback.success(`战役 "${deleted}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除战役失败');
  }
}

function syncMissionCount() {
  const manifest = project.activeManifest;
  if (!manifest) return;
  project.updateManifest(manifest.modRoot, {
    entitySummaries: {
      ...manifest.entitySummaries,
      missions: missions.value.length,
    },
  });
}

function isValidMissionId(id: string): boolean {
  return id.length > 0 && !id.includes('/') && !id.includes('\\') && id !== '.' && id !== '..' && !id.includes('..');
}

onMounted(() => {
  loadFileList();
});

watch(
  () => project.activeModRoot,
  () => {
    missionRows.value = [];
    missionIcons.value = {};
    loadFileList();
  },
);

watch(
  () => props.refreshToken,
  () => loadFileList(),
);
</script>
