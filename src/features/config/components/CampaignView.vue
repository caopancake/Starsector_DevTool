<template>
  <div class="campaign-view">
    <aside class="campaign-file-list">
      <header class="campaign-file-list-header">
        <h3>Campaign CSV</h3>
      </header>
      <ul class="campaign-file-items">
        <li
          v-for="file in csvFiles"
          :key="file"
          class="campaign-file-item"
          :class="{ active: file === selectedFile }"
          @click="selectFile(file)"
        >
          {{ fileName(file) }}
        </li>
      </ul>
    </aside>
    <main v-if="tableData" class="campaign-editor">
      <header class="campaign-editor-header">
        <h3>{{ fileName(selectedFile) }}</h3>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </header>
      <div class="campaign-table-wrapper">
        <table class="campaign-table">
          <thead>
            <tr>
              <th v-for="col in tableData.header" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIdx) in tableData.rows" :key="rowIdx">
              <td v-for="col in tableData.header" :key="col" contenteditable="true" @blur="onCellBlur(rowIdx, col, $event)">
                {{ cellValue(row[col]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <div v-else class="config-placeholder">
      <p>选择一个 CSV 文件以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useSettingsStore } from '../../../app/settings.store';
import { scanCampaign, loadCampaignCsv, saveCampaignCsv } from '../../../shared/api/tauri';
import { formatError } from '../../../shared/lib/errors';
import type { CsvTable } from '../../../shared/api/tauri';
import type { JsonValue } from '../../../shared/types';

const project = useProjectStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const csvFiles = ref<string[]>([]);
const selectedFile = ref<string | null>(null);
const tableData = ref<CsvTable | null>(null);
const saving = ref(false);

const modRoot = computed(() => project.activeModData?.modRoot ?? null);

function fileName(path: string | null): string {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

function cellValue(value: JsonValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

async function loadFileList() {
  if (!modRoot.value) {
    csvFiles.value = [];
    return;
  }
  try {
    csvFiles.value = await scanCampaign(modRoot.value);
  } catch (error) {
    message.error(formatError(error));
    csvFiles.value = [];
  }
}

async function selectFile(file: string) {
  if (!modRoot.value) return;
  selectedFile.value = file;
  try {
    tableData.value = await loadCampaignCsv(modRoot.value, file);
  } catch (error) {
    message.error(formatError(error));
    tableData.value = null;
  }
}

function onCellBlur(rowIdx: number, col: string, event: Event) {
  if (!tableData.value) return;
  const target = event.target as HTMLElement;
  const newValue = target.textContent ?? '';
  tableData.value.rows[rowIdx][col] = newValue;
}

async function save() {
  if (!modRoot.value || !selectedFile.value || !tableData.value) return;
  saving.value = true;
  try {
    await saveCampaignCsv(modRoot.value, selectedFile.value, tableData.value.header, tableData.value.rows);
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
  tableData.value = null;
  loadFileList();
});
</script>

<style scoped>
.campaign-view {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.campaign-file-list {
  width: 220px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.campaign-file-list-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border);
}

.campaign-file-list-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.campaign-file-items {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.campaign-file-item {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.campaign-file-item:hover {
  background: var(--color-hover);
}

.campaign-file-item.active {
  background: var(--color-active);
}

.campaign-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.campaign-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.campaign-editor-header h3 {
  margin: 0;
  font-size: 14px;
}

.campaign-table-wrapper {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.campaign-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
}

.campaign-table th,
.campaign-table td {
  border: 1px solid var(--color-border);
  padding: 4px 8px;
  text-align: left;
  white-space: nowrap;
}

.campaign-table th {
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  font-weight: 600;
}

.campaign-table td[contenteditable]:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.config-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}
</style>
