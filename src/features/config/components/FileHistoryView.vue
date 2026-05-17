<template>
  <section class="file-history-page">
    <header class="file-history-header">
      <div>
        <h1>文件历史</h1>
        <p>{{ modTitle }}</p>
      </div>
      <n-button type="error" ghost :disabled="historyCount === 0" @click="confirmClear">清空文件历史</n-button>
    </header>

    <div class="file-history-summary">
      <div>
        <span>可回退</span>
        <strong>{{ undoStack.length }}</strong>
      </div>
      <div>
        <span>可重做</span>
        <strong>{{ redoStack.length }}</strong>
      </div>
      <div>
        <span>总计</span>
        <strong>{{ historyCount }}</strong>
      </div>
    </div>

    <div class="file-history-stacks">
      <section class="file-history-panel">
        <header>
          <h2>可撤销</h2>
          <n-button size="small" :disabled="!canUndo" @click="undoOne">撤销</n-button>
        </header>
        <p v-if="undoStack.length === 0" class="file-history-empty">没有可回退的文件保存历史。</p>
        <div v-else class="file-history-entry-list">
          <article v-for="(item, index) in undoDisplayItems" :key="item.id" class="file-history-entry">
            <div class="file-history-entry-main">
              <span class="file-history-entry-index">#{{ index + 1 }}</span>
              <div>
                <strong>{{ item.label }}</strong>
                <span>{{ formatTimestamp(item.timestamp) }}</span>
              </div>
              <em>{{ formatItemKind(item) }}</em>
            </div>
            <ul v-if="item.kind === 'file-save'" class="file-history-change-list">
              <li v-for="change in item.changes" :key="`${item.id}:${change.path}`">
                <code>{{ change.path }}</code>
                <span>{{ formatChange(change) }}</span>
              </li>
            </ul>
            <p v-else class="file-history-barrier">屏障原因：{{ item.reason }}</p>
          </article>
        </div>
      </section>

      <section class="file-history-panel">
        <header>
          <h2>可重做</h2>
          <n-button size="small" :disabled="!canRedo" @click="redoOne">重做</n-button>
        </header>
        <p v-if="redoStack.length === 0" class="file-history-empty">没有可重做的文件保存历史。</p>
        <div v-else class="file-history-entry-list">
          <article v-for="(item, index) in redoDisplayItems" :key="item.id" class="file-history-entry">
            <div class="file-history-entry-main">
              <span class="file-history-entry-index">#{{ index + 1 }}</span>
              <div>
                <strong>{{ item.label }}</strong>
                <span>{{ formatTimestamp(item.timestamp) }}</span>
              </div>
              <em>{{ formatItemKind(item) }}</em>
            </div>
            <ul v-if="item.kind === 'file-save'" class="file-history-change-list">
              <li v-for="change in item.changes" :key="`${item.id}:${change.path}`">
                <code>{{ change.path }}</code>
                <span>{{ formatChange(change) }}</span>
              </li>
            </ul>
            <p v-else class="file-history-barrier">屏障原因：{{ item.reason }}</p>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useSettingsStore } from '../../../app/settings-store';
import { buildThemeOverrides, discreteConfigProviderProps } from '../../../app/theme-overrides';
import type { FileChangeRecord } from '../../../shared/api/files-api';
import { applyFileSaveHistoryEntry } from '../../file-history/file-history-service';
import { useFileHistoryStore } from '../../file-history/file-history-store';
import type { FileHistoryItem, FileSaveHistoryEntry } from '../../file-history/file-history-types';
import { useProjectStore } from '../../project/project-store';
import { useTablesStore } from '../../tables/tables-store';

const project = useProjectStore();
const tables = useTablesStore();
const fileHistory = useFileHistoryStore();
const settings = useSettingsStore();
const themeOverrides = computed(() => buildThemeOverrides(settings));

const { dialog, message } = createDiscreteApi(['dialog', 'message'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

const activeMod = computed(() => project.activeModData);
const modTitle = computed(() => activeMod.value?.modInfo?.name ?? activeMod.value?.modRoot ?? '未选择 Mod');
const stacks = computed(() => (activeMod.value ? fileHistory.getHistoryStacks(activeMod.value.modRoot) : { undoStack: [], redoStack: [] }));
const undoStack = computed(() => stacks.value.undoStack);
const redoStack = computed(() => stacks.value.redoStack);
const undoDisplayItems = computed(() => [...undoStack.value].reverse());
const redoDisplayItems = computed(() => [...redoStack.value].reverse());
const historyCount = computed(() => undoStack.value.length + redoStack.value.length);
const canUndo = computed(() => Boolean(fileHistory.peekFileUndo()));
const canRedo = computed(() => Boolean(fileHistory.peekFileRedo()));

function confirmClear() {
  const modData = activeMod.value;
  if (!modData || historyCount.value === 0) return;
  dialog.warning({
    title: '清空文件历史',
    content: '这会清空当前 Mod 的文件级 undo/redo 栈，不会修改任何磁盘文件。确认清空？',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: () => {
      fileHistory.clearForMod(modData.modRoot);
      message.success('文件历史已清空');
    },
  });
}

function undoOne() {
  const entry = fileHistory.peekFileUndo();
  if (!entry) return;
  confirmApply(entry, 'undo');
}

function redoOne() {
  const entry = fileHistory.peekFileRedo();
  if (!entry) return;
  confirmApply(entry, 'redo');
}

function confirmApply(entry: FileSaveHistoryEntry, direction: 'undo' | 'redo') {
  const action = direction === 'undo' ? '撤销' : '重做';
  dialog.warning({
    title: `${action}文件历史`,
    content: `${action}会直接写回磁盘。确认处理“${entry.label}”？`,
    positiveText: action,
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await applyFileSaveHistoryEntry(entry, direction, project, tables);
        if (direction === 'undo') {
          fileHistory.commitFileUndo(entry.id);
        } else {
          fileHistory.commitFileRedo(entry.id);
        }
        message.success(`已${action}`);
      } catch (error) {
        message.error(`${action}文件历史失败：${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}

function formatItemKind(item: FileHistoryItem): string {
  if (item.kind === 'barrier') return '屏障';
  return `${item.changes.length} 个文件变更`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatChange(change: FileChangeRecord): string {
  const type = change.kind === 'directory' ? '目录' : '文件';
  return `${type}：${formatExists(change.beforeExists)} → ${formatExists(change.afterExists)}`;
}

function formatExists(exists: boolean): string {
  return exists ? '存在' : '不存在';
}
</script>
