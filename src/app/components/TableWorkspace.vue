<template>
  <main class="workspace">
    <header class="topbar">
      <div class="view-heading">
        <div class="view-title">{{ MODULE_LABELS[tables.currentTab] }}</div>
        <div class="view-meta">{{ tables.tableInfo }}</div>
      </div>
      <div class="top-actions">
        <div class="top-action-group">
          <n-input v-model:value="tables.searchText" class="top-search-input" clearable placeholder="搜索 ID / 名称" />
          <n-select v-model:value="tables.currentFaction" class="top-faction-select" :options="factionOptions" placeholder="势力" />
        </div>
        <div class="top-action-group">
          <n-button :disabled="!activeData" @click="$emit('add-row')">新建</n-button>
          <n-button type="error" ghost :disabled="!tables.selectedRowId" @click="$emit('delete-row')">删除</n-button>
        </div>
        <div class="top-action-group">
          <n-button :disabled="!tables.hasChanges" @click="$emit('revert')">撤销修改</n-button>
          <n-button
            type="primary"
            :loading="tables.saving"
            :disabled="!tables.hasChanges"
            @pointerdown.prevent="$emit('save')"
            @click.prevent
          >
            保存 CSV
          </n-button>
        </div>
      </div>
    </header>
    <section class="content-grid">
      <DataTable />
      <DetailPane
        @open-file-editor="$emit('open-file-editor', $event)"
        @open-ship="$emit('open-ship', $event)"
        @open-weapon="$emit('open-weapon', $event)"
        @open-weapon-preview="$emit('open-weapon-preview', $event)"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from '../DataTable.vue';
import DetailPane from '../DetailPane.vue';
import { useTablesStore } from '../../features/tables/tables.store';
import { useProjectStore } from '../../features/project/project.store';
import { MODULE_LABELS } from '../../shared/lib/starsector';
import type { FileEditorRequest } from '../../features/workspace/file-editor-window';

defineEmits<{
  'add-row': [];
  'delete-row': [];
  revert: [];
  save: [];
  'open-file-editor': [request: FileEditorRequest];
  'open-ship': [id: string];
  'open-weapon': [id: string];
  'open-weapon-preview': [id: string];
}>();

const tables = useTablesStore();
const project = useProjectStore();

const activeData = computed(() => project.activeModData);

const factionOptions = computed(() => {
  const base = [{ label: '全部势力', value: 'all' }];
  if (!activeData.value) return base;
  return base.concat(Object.entries(activeData.value.factionMeta).map(([value, meta]) => ({ label: meta.name, value })));
});
</script>
