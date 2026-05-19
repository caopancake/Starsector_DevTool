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
      <n-button size="small" block @click="createFaction">新建势力</n-button>
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
import { computed, h, ref, watch } from 'vue';
import { NCheckbox } from 'naive-ui';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import {
  createIndexedConfigEntityWithFileHistory,
  deleteIndexedConfigEntityWithFileHistory,
} from '@/orchestrators/config-save.orchestrator';
import { buildFactionIndexRow, createDefaultFaction } from '@/domain/config/config-entities';
import { loadImageDataUrl } from '@/services/assets.service';
import type { JsonValue } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{ selectedId: string }>();
const emit = defineEmits<{ select: [factionId: string] }>();

const project = useProjectStore();
const settings = useSettingsStore();
const feedback = useAppFeedback();

const showCreateDialog = ref(false);
const newFactionId = ref('');
const factionCrests = ref<Record<string, string>>({});
const deleteFactionDataFile = ref(false);
const pendingDeleteFaction = ref('');

interface ConfigFactionViewItem {
  id: string;
  displayName: string;
  colorCss: string;
}

function rgbaToCss(color: JsonValue): string {
  if (Array.isArray(color) && color.length >= 3) {
    const r = Math.round(Number(color[0]) || 0);
    const g = Math.round(Number(color[1]) || 0);
    const b = Math.round(Number(color[2]) || 0);
    const a = Math.max(0, Math.min(255, Math.round(Number(color[3] ?? 255) || 0))) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return 'rgba(128, 128, 128, 1)';
}

function str(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const factions = computed<ConfigFactionViewItem[]>(() => {
  const modData = project.activeModData;
  if (!modData) return [];
  const files = modData.factionFiles;
  return Object.keys(files)
    .sort()
    .map((id) => ({
      id,
      displayName: String(files[id]?.displayName ?? id),
      colorCss: rgbaToCss(files[id]?.color),
    }));
});

function factionCrest(id: string): string {
  return factionCrests.value[id] ?? '';
}

async function refreshFactionCrests() {
  const modData = project.activeModData;
  if (!modData) {
    factionCrests.value = {};
    return;
  }
  const coreRoot = settings.starsectorRoot || modData.starsectorRoot || undefined;
  const crests: Record<string, string> = {};
  await Promise.all(
    Object.entries(modData.factionFiles).map(async ([id, data]) => {
      const crest = str(data.crest);
      if (!crest) return;
      try {
        crests[id] = (await loadImageDataUrl(modData.modRoot, crest, coreRoot)) ?? '';
      } catch {
        crests[id] = '';
      }
    }),
  );
  factionCrests.value = crests;
}

function selectFaction(id: string) {
  emit('select', id);
}

async function createFaction() {
  const modData = project.activeModData;
  if (!modData) return;

  newFactionId.value = '';
  showCreateDialog.value = true;
}

async function doCreate() {
  const modData = project.activeModData;
  if (!modData) return;

  const trimmedId = newFactionId.value.trim();
  if (!trimmedId) {
    feedback.warning('ID 不能为空');
    return;
  }
  if (modData.factionFiles[trimmedId]) {
    feedback.warning(`势力 "${trimmedId}" 已存在`);
    return;
  }
  try {
    const result = await createIndexedConfigEntityWithFileHistory({
      modRoot: modData.modRoot,
      kind: 'faction',
      nextId: trimmedId,
      indexRow: buildFactionIndexRow(trimmedId),
      payload: { file: createDefaultFaction(trimmedId) },
    });
    const payload = result.entityPayload;
    const data =
      payload && payload.file && typeof payload.file === 'object' && !Array.isArray(payload.file)
        ? payload.file
        : createDefaultFaction(trimmedId);
    modData.factionFiles[trimmedId] = data;
    modData.factionMeta[trimmedId] = {
      name: String(data.displayName ?? trimmedId),
      color: rgbaToCss(data.color),
    };
    feedback.success(`势力 "${trimmedId}" 已创建`);
    showCreateDialog.value = false;
    await refreshFactionCrests();
    selectFaction(trimmedId);
  } catch (error) {
    feedback.error(error, '创建势力失败');
  }
}

function confirmDelete(id: string) {
  pendingDeleteFaction.value = id;
  deleteFactionDataFile.value = false;
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
      await doDelete(pendingDeleteFaction.value, deleteFactionDataFile.value);
      pendingDeleteFaction.value = '';
    },
  });
}

async function doDelete(id: string, deleteFile: boolean) {
  const modData = project.activeModData;
  if (!modData) return;

  try {
    await deleteIndexedConfigEntityWithFileHistory(modData.modRoot, 'faction', id, deleteFile);
    delete modData.factionFiles[id];
    delete modData.factionMeta[id];
    delete factionCrests.value[id];
    if (props.selectedId === id) {
      emit('select', '');
    }
    feedback.success(`势力 "${id}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除势力失败');
  }
}

watch(
  () => project.activeModRoot,
  () => refreshFactionCrests(),
  { immediate: true },
);
</script>
