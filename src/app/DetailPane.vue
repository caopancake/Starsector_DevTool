<template>
  <aside class="detail-pane">
    <div class="pane-title">上下文</div>
    <template v-if="tables.selectedRow">
      <section class="panel-card detail-card record-card">
        <div class="detail-thumbnail">
          <img v-if="previewState.src" :src="previewState.src" :alt="previewState.alt" />
          <div v-else class="thumbnail-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <strong>{{ previewState.title }}</strong>
            <span>{{ previewState.detail }}</span>
          </div>
        </div>
        <div class="detail-id">{{ rowId(tables.selectedRow) }}</div>
        <div class="detail-name">{{ displayName }}</div>
      </section>
      <section class="panel-card detail-card">
        <div class="panel-section-title">操作</div>
        <div class="detail-actions">
          <n-button v-if="tables.currentTab === 'ships'" block @click="$emit('open-ship', rowId(tables.selectedRow))">舰船编辑器</n-button>
          <n-button v-if="tables.currentTab === 'weapons'" block @click="editors.openWeapon(rowId(tables.selectedRow))"
            >武器编辑器</n-button
          >
          <n-button v-if="tables.currentTab === 'weapons'" block tertiary @click="editors.openPreview(rowId(tables.selectedRow))"
            >发射预览</n-button
          >
        </div>
        <div v-if="!hasActions" class="muted">当前模块没有专用编辑器。</div>
      </section>
      <section class="panel-card detail-card">
        <div class="panel-section-title">字段速览</div>
        <div class="kv-list">
          <div v-for="col in summaryColumns" :key="col" class="kv-row">
            <span>{{ col }}</span>
            <strong>{{ cell(tables.selectedRow[col]) }}</strong>
          </div>
        </div>
      </section>
    </template>
    <div v-else class="panel-empty detail-empty">
      <strong>未选择记录</strong>
      <span>点击一行查看上下文操作，双击单元格编辑 CSV。</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTablesStore } from '../features/tables/tables.store';
import { useEditorsStore } from '../features/editors/editors.store';
import { useProjectStore } from '../features/project/project.store';
import { cell, MODULE_LABELS, rowId, str } from '../shared/lib/starsector';
import type { RowData, TableKey } from '../shared/types';

defineEmits<{ 'open-ship': [id: string] }>();

const tables = useTablesStore();
const editors = useEditorsStore();
const project = useProjectStore();

const displayName = computed(() => {
  if (!tables.selectedRow) return '';
  return cell(tables.selectedRow.name) || cell(tables.selectedRow.hullName) || cell(tables.selectedRow.designation) || '未命名记录';
});

const hasActions = computed(() => tables.currentTab === 'ships' || tables.currentTab === 'weapons');
const summaryColumns = computed(() => tables.visibleColumns.slice(0, 8));

interface PreviewState {
  alt: string;
  detail: string;
  src: string;
  title: string;
}

const previewState = computed<PreviewState>(() => {
  const row = tables.selectedRow;
  const data = project.data;
  if (!row || !data) return noPreview(tables.currentTab);

  const id = rowId(row);
  if (tables.currentTab === 'ships') {
    return previewFromMap(data.shipSprites[id], expectedShipSprite(data.shipFiles[id]), id, tables.currentTab);
  }
  if (tables.currentTab === 'weapons') {
    return previewFromMap(data.weaponSpritesData[id], expectedWeaponSprite(data.wpnFiles[id]), id, tables.currentTab);
  }
  if (tables.currentTab === 'hullmods') {
    return previewFromMap(data.hullmodSprites[id], str(row.sprite), id, tables.currentTab);
  }
  if (tables.currentTab === 'industries') {
    return previewFromMap(data.industrySprites[id], str(row.image), id, tables.currentTab);
  }
  return noPreview(tables.currentTab);
});

function previewFromMap(src: string | undefined, expectedPath: string, id: string, tab: TableKey): PreviewState {
  if (src) return { alt: id, detail: '', src, title: '' };
  if (expectedPath) {
    return {
      alt: id,
      detail: expectedPath,
      src: '',
      title: '贴图缺失',
    };
  }
  return noPreview(tab);
}

function noPreview(tab: TableKey): PreviewState {
  return {
    alt: MODULE_LABELS[tab],
    detail: `${MODULE_LABELS[tab]}当前没有可用缩略图。`,
    src: '',
    title: '无预览',
  };
}

function expectedShipSprite(ship: RowData | undefined): string {
  return str(ship?.spriteName);
}

function expectedWeaponSprite(weapon: RowData | undefined): string {
  return (
    str(weapon?.turretSprite) ||
    str(weapon?.hardpointSprite) ||
    str(weapon?.turretGunSprite) ||
    str(weapon?.hardpointGunSprite) ||
    str(weapon?.turretUnderSprite) ||
    str(weapon?.hardpointUnderSprite)
  );
}
</script>
