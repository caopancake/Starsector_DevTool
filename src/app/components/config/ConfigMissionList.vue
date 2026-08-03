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
      <n-button size="small" block @click="openCreateDialog">新建战役</n-button>
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
import { h, onMounted, ref, watch } from 'vue';
import { NCheckbox } from 'naive-ui/es/checkbox';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{
  selectedId: string | null;
  refreshToken: number;
  missions: Array<{ id: string }>;
  missionIcons: Record<string, string>;
  modRoot: string | null;
  sessionId: string | null;
  refreshMissionList: () => Promise<void>;
  createMission: (sessionId: string, modRoot: string, id: string) => Promise<boolean>;
  deleteMission: (sessionId: string, modRoot: string, id: string, deleteDirectory: boolean) => Promise<boolean>;
  missionExists: (id: string) => boolean;
  isValidMissionId: (id: string) => boolean;
}>();
const emit = defineEmits<{ select: [missionId: string | null] }>();

const feedback = useAppFeedback();

const showCreateDialog = ref(false);
const newMissionId = ref('');
const createModRoot = ref<string | null>(null);
const createSessionId = ref<string | null>(null);

function missionIcon(id: string): string {
  return props.missionIcons[id] ?? '';
}

async function refreshList() {
  try {
    await props.refreshMissionList();
    if (!props.selectedId && props.missions[0]) emit('select', props.missions[0].id);
    if (props.selectedId && !props.missions.some((mission) => mission.id === props.selectedId))
      emit('select', props.missions[0]?.id ?? null);
  } catch (error) {
    feedback.error(error, '加载战役列表失败');
  }
}

function openCreateDialog() {
  createModRoot.value = props.modRoot;
  createSessionId.value = props.sessionId;
  if (!createModRoot.value || !createSessionId.value) return;
  newMissionId.value = '';
  showCreateDialog.value = true;
}

async function doCreateMission() {
  const targetModRoot = createModRoot.value;
  const targetSessionId = createSessionId.value;
  if (!targetModRoot || !targetSessionId) return false;
  const id = newMissionId.value.trim();
  if (!id) {
    feedback.warning('战役 ID 不能为空');
    return false;
  }
  if (!props.isValidMissionId(id)) {
    feedback.error('战役 ID 不能包含路径分隔符或 ..');
    return false;
  }
  if (props.missionExists(id)) {
    feedback.warning(`战役 "${id}" 已存在`);
    return false;
  }
  try {
    if (!(await props.createMission(targetSessionId, targetModRoot, id))) return false;
    showCreateDialog.value = false;
    if (props.modRoot !== targetModRoot || props.sessionId !== targetSessionId) return true;
    await refreshList();
    emit('select', id);
  } catch (error) {
    feedback.error(error, '创建战役失败');
    return false;
  }
  return true;
}

function confirmDeleteMission(id: string) {
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!deleteModRoot || !deleteSessionId) return;
  const deleteMissionDirectory = ref(false);
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
    onConfirm: async () => {
      await deleteMissionTarget(deleteSessionId, deleteModRoot, id, deleteMissionDirectory.value);
    },
  });
}

async function deleteMissionTarget(deleteSessionId: string, deleteModRoot: string, id: string, deleteDirectory: boolean) {
  try {
    await props.deleteMission(deleteSessionId, deleteModRoot, id, deleteDirectory);
    if (props.modRoot !== deleteModRoot || props.sessionId !== deleteSessionId) return;
    await refreshList();
    const nextId = props.missions[0]?.id ?? null;
    if (props.selectedId === id) emit('select', nextId);
  } catch (error) {
    feedback.error(error, '删除战役失败');
  }
}

onMounted(() => {
  refreshList();
});

watch(
  () => props.refreshToken,
  () => refreshList(),
);
</script>
