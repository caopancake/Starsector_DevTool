<template>
  <aside class="detail-pane">
    <div class="pane-title">当前记录</div>
    <template v-if="tables.selectedRow">
      <div class="detail-id">{{ rowId(tables.selectedRow) }}</div>
      <div class="detail-name">{{ cell(tables.selectedRow.name) || cell(tables.selectedRow.hullName) }}</div>
      <div class="detail-thumbnail">
        <img
          v-if="tables.currentTab === 'ships' && project.data?.shipSprites[rowId(tables.selectedRow)]"
          :src="project.data.shipSprites[rowId(tables.selectedRow)]"
          :alt="rowId(tables.selectedRow)"
        />
        <img
          v-else-if="tables.currentTab === 'weapons' && project.data?.weaponSpritesData[rowId(tables.selectedRow)]"
          :src="project.data.weaponSpritesData[rowId(tables.selectedRow)]"
          :alt="rowId(tables.selectedRow)"
        />
        <img
          v-else-if="tables.currentTab === 'hullmods' && project.data?.hullmodSprites[rowId(tables.selectedRow)]"
          :src="project.data.hullmodSprites[rowId(tables.selectedRow)]"
          :alt="rowId(tables.selectedRow)"
        />
        <div v-else class="thumbnail-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>无预览</span>
        </div>
      </div>
      <div class="detail-actions">
        <n-button v-if="tables.currentTab === 'ships'" block @click="$emit('open-ship', rowId(tables.selectedRow))">舰船编辑器</n-button>
        <n-button v-if="tables.currentTab === 'weapons'" block @click="editors.openWeapon(rowId(tables.selectedRow))">武器编辑器</n-button>
        <n-button v-if="tables.currentTab === 'weapons'" block tertiary @click="editors.openPreview(rowId(tables.selectedRow))"
          >弹道预览</n-button
        >
      </div>
      <div class="kv-list">
        <div v-for="col in tables.visibleColumns.slice(0, 12)" :key="col" class="kv-row">
          <span>{{ col }}</span>
          <strong>{{ cell(tables.selectedRow[col]) }}</strong>
        </div>
      </div>
    </template>
    <div v-else class="muted">点击一行查看详情，双击单元格编辑。</div>
  </aside>
</template>

<script setup lang="ts">
import { useTablesStore } from '../features/tables/tables.store';
import { useEditorsStore } from '../features/editors/editors.store';
import { useProjectStore } from '../features/project/project.store';
import { cell, rowId } from '../shared/lib/starsector';

defineEmits<{ 'open-ship': [id: string] }>();

const tables = useTablesStore();
const editors = useEditorsStore();
const project = useProjectStore();
</script>
