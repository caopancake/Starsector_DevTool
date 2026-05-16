<template>
  <aside class="faction-list">
    <header class="faction-list-header">
      <h3>势力列表</h3>
    </header>

    <ul class="faction-list-items">
      <li
        v-for="faction in factions"
        :key="faction.id"
        class="faction-list-item"
        :class="{ active: faction.id === selectedFaction }"
        @click="selectFaction(faction.id)"
      >
        <span class="color-swatch" :style="{ backgroundColor: faction.colorHex }" />
        <span class="faction-name">{{ faction.displayName || faction.id }}</span>
        <n-button size="tiny" quaternary class="faction-delete-btn" @click.stop="confirmDelete(faction.id)"> &times; </n-button>
      </li>
    </ul>

    <footer class="faction-list-footer">
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
import { computed, ref } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useSettingsStore } from '../../../app/settings.store';
import { createFactionFile, deleteFactionFile } from '../config.service';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue } from '../../../shared/types';

const emit = defineEmits<{ select: [factionId: string] }>();

const project = useProjectStore();
const settings = useSettingsStore();

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const selectedFaction = ref<string | null>(null);
const showCreateDialog = ref(false);
const newFactionId = ref('');

interface FactionListItem {
  id: string;
  displayName: string;
  colorHex: string;
}

function rgbToHex(color: JsonValue): string {
  if (Array.isArray(color) && color.length >= 3) {
    const r = Math.round(Number(color[0]) || 0);
    const g = Math.round(Number(color[1]) || 0);
    const b = Math.round(Number(color[2]) || 0);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return 'rgb(128, 128, 128)';
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
      colorHex: rgbToHex(files[id]?.color),
    }));
});

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
    message.success(`势力 "${trimmedId}" 已创建`);
    showCreateDialog.value = false;
    selectFaction(trimmedId);
  } catch (error) {
    message.error(formatError(error));
  }
}

function confirmDelete(id: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除势力 "${id}" 吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => doDelete(id),
  });
}

async function doDelete(id: string) {
  const modData = project.activeModData;
  if (!modData) return;

  try {
    await deleteFactionFile(modData.modRoot, id);
    delete modData.factionFiles[id];
    if (selectedFaction.value === id) {
      selectedFaction.value = null;
      emit('select', '');
    }
    message.success(`势力 "${id}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
  }
}
</script>

<style scoped>
.faction-list {
  width: 240px;
  min-width: 200px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.faction-list-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border);
}

.faction-list-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.faction-list-items {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.faction-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.faction-list-item:hover {
  background: var(--color-hover);
}

.faction-list-item.active {
  background: var(--color-active);
}

.color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.faction-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.faction-delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.faction-list-item:hover .faction-delete-btn {
  opacity: 1;
}

.faction-list-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}
</style>
