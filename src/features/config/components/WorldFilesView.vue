<template>
  <div class="world-files-view">
    <aside class="world-file-list">
      <header class="world-file-list-header">
        <h3>World 文件</h3>
      </header>
      <ul class="world-file-items">
        <li v-if="files.length === 0" class="world-file-empty">当前 Mod 的 data/world/ 下无可编辑配置文件（factions 在势力 Tab 中编辑）</li>
        <li v-for="file in files" :key="file" class="world-file-item" :class="{ active: file === selectedFile }" @click="selectFile(file)">
          {{ shortName(file) }}
        </li>
      </ul>
    </aside>
    <main v-if="selectedFile && localData" class="world-file-editor">
      <header class="world-file-editor-header">
        <h3>{{ shortName(selectedFile) }}</h3>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </header>
      <div class="world-file-editor-body">
        <JsonFieldEditor v-model="localData" :known-keys="[]" />
      </div>
    </main>
    <div v-else class="config-placeholder">
      <p>选择一个文件以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useSettingsStore } from '../../../app/settings.store';
import { scanWorldFiles, loadWorldFile, saveWorldFile } from '../../../shared/api/tauri';
import { formatError } from '../../../shared/lib/errors';
import { deepClone } from '../../../shared/lib/starsector';
import type { RowData } from '../../../shared/types';
import JsonFieldEditor from './JsonFieldEditor.vue';

const project = useProjectStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const files = ref<string[]>([]);
const selectedFile = ref<string | null>(null);
const localData = ref<RowData | null>(null);
const saving = ref(false);

const modRoot = computed(() => project.activeModData?.modRoot ?? null);

function shortName(path: string | null): string {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

async function loadFileList() {
  if (!modRoot.value) {
    files.value = [];
    return;
  }
  try {
    files.value = await scanWorldFiles(modRoot.value);
  } catch (error) {
    message.error(formatError(error));
    files.value = [];
  }
}

async function selectFile(file: string) {
  if (!modRoot.value) return;
  selectedFile.value = file;
  try {
    const data = await loadWorldFile(modRoot.value, file);
    localData.value = deepClone(data);
  } catch (error) {
    message.error(formatError(error));
    localData.value = null;
  }
}

async function save() {
  if (!modRoot.value || !selectedFile.value || !localData.value) return;
  saving.value = true;
  try {
    await saveWorldFile(modRoot.value, selectedFile.value, localData.value);
    message.success('保存成功');
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadFileList();
});

watch(modRoot, () => {
  selectedFile.value = null;
  localData.value = null;
  loadFileList();
});
</script>

<style scoped>
.world-files-view {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.world-file-list {
  width: 220px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.world-file-list-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border);
}

.world-file-list-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.world-file-items {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.world-file-item {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-file-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}

.world-file-item:hover {
  background: var(--color-hover);
}

.world-file-item.active {
  background: var(--color-active);
}

.world-file-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.world-file-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.world-file-editor-header h3 {
  margin: 0;
  font-size: 14px;
}

.world-file-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.config-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}
</style>
