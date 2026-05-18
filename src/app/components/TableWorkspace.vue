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
          <n-button type="error" ghost :disabled="!tables.selectedRowKey" @click="$emit('delete-row')">删除</n-button>
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
      <DetailPane @detail-action="$emit('detail-action', $event)" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from '@/app/DataTable.vue';
import DetailPane from '@/app/DetailPane.vue';
import { useTablesStore } from '@/stores/tables.store';
import { useProjectStore } from '@/stores/project.store';
import { MODULE_LABELS } from '@/shared/lib/starsector';
import type { TableDetailAction } from '@/domain/tables/table-detail-actions';

defineEmits<{
  'add-row': [];
  'delete-row': [];
  revert: [];
  save: [];
  'detail-action': [request: TableDetailAction];
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
