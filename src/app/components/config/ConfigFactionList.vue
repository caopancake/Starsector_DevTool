<template>
  <aside class="faction-list config-entity-list">
    <header class="faction-list-header config-entity-list-header">
      <h3>势力列表</h3>
    </header>

    <ul class="faction-list-items config-entity-list-items">
      <li
        v-for="faction in factions"
        :key="faction.id"
        class="faction-list-item config-entity-list-item"
        :class="{ active: faction.id === selectedId }"
        @click="selectFaction(faction.id)"
      >
        <span class="faction-list-preview config-entity-thumb">
          <img v-if="factionCrest(faction.id)" :src="factionCrest(faction.id)" alt="" />
          <span v-else class="color-swatch" :style="{ backgroundColor: faction.colorCss }" />
        </span>
        <span class="faction-name config-entity-name">{{ faction.displayName || faction.id }}</span>
        <n-button
          size="tiny"
          quaternary
          class="faction-delete-btn config-entity-delete compact-icon-button"
          title="删除势力"
          @click.stop="confirmDelete(faction.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </n-button>
      </li>
    </ul>

    <footer class="faction-list-footer config-entity-list-footer">
      <n-button size="small" block @click="openCreateDialog">新建势力</n-button>
    </footer>

    <!-- Create dialog -->
    <n-modal
      v-model:show="showCreateDialog"
      preset="dialog"
      title="新建势力"
      positive-text="创建"
      negative-text="取消"
      @positive-click="doCreate"
    >
      <n-input v-model:value="newFactionId" placeholder="输入势力 ID（英文标识）" autofocus />
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { NCheckbox } from 'naive-ui/es/checkbox';
import type { RowData } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { configFactionListItems } from '@/domain/config/config-entities';

const props = defineProps<{
  selectedId: string | null;
  factions: Record<string, RowData>;
  factionCrests: Record<string, string>;
  modRoot: string | null;
  sessionId: string | null;
  createFaction: (sessionId: string, modRoot: string, id: string) => Promise<boolean>;
  deleteFaction: (sessionId: string, modRoot: string, id: string, deleteFile: boolean) => Promise<boolean>;
}>();
const emit = defineEmits<{ select: [factionId: string | null] }>();

const feedback = useAppFeedback();

const showCreateDialog = ref(false);
const newFactionId = ref('');
const createModRoot = ref<string | null>(null);
const createSessionId = ref<string | null>(null);

const factions = computed(() => configFactionListItems(props.factions));

function factionCrest(id: string): string {
  return props.factionCrests[id] ?? '';
}

function selectFaction(id: string) {
  emit('select', id);
}

function openCreateDialog() {
  createModRoot.value = props.modRoot;
  createSessionId.value = props.sessionId;
  if (!createModRoot.value || !createSessionId.value) return;
  newFactionId.value = '';
  showCreateDialog.value = true;
}

async function doCreate() {
  const targetModRoot = createModRoot.value;
  const targetSessionId = createSessionId.value;
  if (!targetModRoot || !targetSessionId) return false;
  const trimmedId = newFactionId.value.trim();
  if (!trimmedId) {
    feedback.warning('ID 不能为空');
    return;
  }
  if (props.factions[trimmedId]) {
    feedback.warning(`势力 "${trimmedId}" 已存在`);
    return;
  }
  try {
    if (!(await props.createFaction(targetSessionId, targetModRoot, trimmedId))) return false;
    showCreateDialog.value = false;
    if (props.modRoot === targetModRoot && props.sessionId === targetSessionId) selectFaction(trimmedId);
  } catch (error) {
    feedback.error(error, '创建势力失败');
  }
}

function confirmDelete(id: string) {
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!deleteModRoot || !deleteSessionId) return;
  const deleteFactionDataFile = ref(false);
  feedback.confirmDanger({
    title: '删除势力',
    content: () =>
      h('div', { class: 'associated-save-dialog' }, [
        h('p', `确定要从 factions.csv 中删除 "${id}" 吗？`),
        h(
          NCheckbox,
          {
            checked: deleteFactionDataFile.value,
            'onUpdate:checked': (checked: boolean) => {
              deleteFactionDataFile.value = checked;
            },
          },
          { default: () => '同时删除势力文件' },
        ),
      ]),
    actionText: '删除',
    onConfirm: async () => {
      await doDelete(deleteSessionId, deleteModRoot, id, deleteFactionDataFile.value);
    },
  });
}

async function doDelete(deleteSessionId: string, deleteModRoot: string, id: string, deleteFile: boolean) {
  try {
    if (!(await props.deleteFaction(deleteSessionId, deleteModRoot, id, deleteFile))) return;
    if (props.modRoot !== deleteModRoot || props.sessionId !== deleteSessionId) return;
    if (props.selectedId === id) {
      emit('select', null);
    }
  } catch (error) {
    feedback.error(error, '删除势力失败');
  }
}
</script>
