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
        :class="{ active: faction.id === selectedFaction }"
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

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="confirmDeleteSelectedFaction"
    >
      <p>确定要从 factions.csv 中删除 "{{ pendingDeleteFaction }}" 吗？</p>
      <n-checkbox v-model:checked="deleteFactionDataFile">同时删除势力文件</n-checkbox>
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useSettingsStore } from '../../../app/settings.store';
import { createFactionFile, deleteFactionFile } from '../config.service';
import { loadImageDataUrl } from '../../../shared/api/tauri';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue } from '../../../shared/types';
import { buildThemeOverrides, discreteConfigProviderProps } from '../../../app/theme-overrides';

const emit = defineEmits<{ select: [factionId: string] }>();

const project = useProjectStore();
const settings = useSettingsStore();
const themeOverrides = computed(() => buildThemeOverrides(settings));

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

const selectedFaction = ref<string | null>(null);
const showCreateDialog = ref(false);
const newFactionId = ref('');
const factionCrests = ref<Record<string, string>>({});
const showDeleteDialog = ref(false);
const deleteFactionDataFile = ref(false);
const pendingDeleteFaction = ref('');

interface FactionListItem {
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

const factions = computed<FactionListItem[]>(() => {
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
  selectedFaction.value = id;
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
    message.warning('ID 不能为空');
    return;
  }
  if (modData.factionFiles[trimmedId]) {
    message.warning(`势力 "${trimmedId}" 已存在`);
    return;
  }
  try {
    const data = await createFactionFile(modData.modRoot, trimmedId);
    modData.factionFiles[trimmedId] = data;
    modData.factionMeta[trimmedId] = {
      name: String(data.displayName ?? trimmedId),
      color: rgbaToCss(data.color),
    };
    message.success(`势力 "${trimmedId}" 已创建`);
    showCreateDialog.value = false;
    await refreshFactionCrests();
    selectFaction(trimmedId);
  } catch (error) {
    message.error(formatError(error));
  }
}

function confirmDelete(id: string) {
  pendingDeleteFaction.value = id;
  deleteFactionDataFile.value = false;
  showDeleteDialog.value = true;
}

async function confirmDeleteSelectedFaction() {
  if (!pendingDeleteFaction.value) return false;
  await doDelete(pendingDeleteFaction.value, deleteFactionDataFile.value);
  pendingDeleteFaction.value = '';
  return true;
}

async function doDelete(id: string, deleteFile: boolean) {
  const modData = project.activeModData;
  if (!modData) return;

  try {
    await deleteFactionFile(modData.modRoot, id, deleteFile);
    delete modData.factionFiles[id];
    delete modData.factionMeta[id];
    delete factionCrests.value[id];
    if (selectedFaction.value === id) {
      selectedFaction.value = null;
      emit('select', '');
    }
    message.success(`势力 "${id}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
  }
}

watch(
  () => project.activeModRoot,
  () => refreshFactionCrests(),
  { immediate: true },
);
</script>
