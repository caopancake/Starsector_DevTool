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
        <div class="detail-id">{{ selectedDisplayId }}</div>
        <div class="detail-name">{{ displayName }}</div>
      </section>
      <section class="panel-card detail-card">
        <div class="panel-section-title">操作</div>
        <div class="detail-actions">
          <n-button v-if="fileEditorAction" block secondary @click="$emit('detail-action', fileEditorAction)">文件编辑器</n-button>
          <n-button v-if="canOpenShipEditor" block secondary @click="$emit('detail-action', { type: 'ship-editor', id: selectedSpecId })">
            舰船编辑器
          </n-button>
          <n-button
            v-if="canOpenWeaponEditor"
            block
            secondary
            @click="$emit('detail-action', { type: 'weapon-editor', id: selectedSpecId })"
          >
            武器编辑器
          </n-button>
          <n-button
            v-if="canOpenWeaponEditor"
            block
            secondary
            @click="$emit('detail-action', { type: 'weapon-preview', id: selectedSpecId })"
          >
            发射预览
          </n-button>
        </div>
        <div v-if="isCommentRow" class="muted">注释行只允许编辑 CSV 内容。</div>
        <div v-else-if="!hasActions" class="muted">当前模块没有专用编辑器。</div>
      </section>
      <section class="panel-card detail-card">
        <div class="panel-section-title">字段速览</div>
        <div class="schema-preview-list">
          <div v-for="item in summaryItems" :key="item.key" class="schema-preview-row">
            <span class="schema-preview-label">{{ item.label }}</span>
            <div class="schema-preview-value">
              <template v-if="item.kind === 'tags' || item.kind === 'multi'">
                <span v-for="tag in item.values" :key="tag" class="schema-preview-tag">{{ tag }}</span>
                <span v-if="item.values.length === 0" class="schema-preview-empty">-</span>
              </template>
              <template v-else-if="item.kind === 'color'">
                <span class="schema-preview-swatch" :style="{ background: item.value }"></span>
                <strong>{{ item.value || '-' }}</strong>
              </template>
              <template v-else>
                <img v-if="showReferenceDecorations && item.sprite" class="schema-preview-sprite" :src="item.sprite" :alt="item.display" />
                <strong>{{ item.display || '-' }}</strong>
                <small v-if="showReferenceDecorations && item.meta">{{ item.meta }}</small>
              </template>
            </div>
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
import { computed, ref, watch } from 'vue';
import { useTablesStore } from '@/stores/tables.store';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import { cell, MODULE_LABELS, rowDisplayId, rowSpecId } from '@/shared/lib/starsector';
import { fileEditorActionForRow, type TableDetailAction } from '@/domain/tables/table-detail-actions';
import { isCsvCommentRow } from '@/domain/tables/csv-comment-row';
import { csvColumnSchemasForTable, type CsvColumnSchema } from '@/domain/tables/csv-column-schema';
import { createCsvSourceIndex, sourceValue } from '@/domain/tables/csv-source-options';
import { queryTableRowPreviewDataUrl } from '@/services/table.service';
import type { SelectOption } from '@/domain/schema/schema-registry';
import type { RowData, TableKey } from '@/shared/types';

defineEmits<{
  'detail-action': [request: TableDetailAction];
}>();

const tables = useTablesStore();
const project = useProjectStore();
const settings = useSettingsStore();
const showReferenceDecorations = computed(() => settings.editMode === 'smart');

const displayName = computed(() => {
  if (!tables.selectedRow) return '';
  return cell(tables.selectedRow.name) || cell(tables.selectedRow.hullName) || cell(tables.selectedRow.designation) || '未命名记录';
});

const selectedDisplayId = computed(() => (tables.selectedRow ? rowDisplayId(tables.selectedRow) : ''));
const selectedSpecId = computed(() => (tables.selectedRow ? rowSpecId(tables.selectedRow, tables.currentTab) : ''));
const isCommentRow = computed(() => isCsvCommentRow(tables.selectedRow, tables.currentTab));
const canOpenShipEditor = computed(() => !isCommentRow.value && tables.currentTab === 'ships' && Boolean(selectedSpecId.value));
const canOpenWeaponEditor = computed(() => !isCommentRow.value && tables.currentTab === 'weapons' && Boolean(selectedSpecId.value));
const hasActions = computed(() => Boolean(fileEditorAction.value || canOpenShipEditor.value || canOpenWeaponEditor.value));
const schemaColumns = computed(() => csvColumnSchemasForTable(tables.currentTab));
const sourceIndex = computed(() => createCsvSourceIndex(schemaColumns.value.map((schema) => schema.source)));
const previewSrc = ref('');
const summaryItems = computed<SchemaPreviewItem[]>(() => {
  const row = tables.selectedRow;
  if (!row) return [];
  return tables.visibleColumns.slice(0, 8).map((column) => {
    const schema = schemaColumns.value.find((item) => item.key === column);
    return schema ? schemaPreviewItem(schema, row) : plainPreviewItem(column, row);
  });
});
const fileEditorAction = computed<TableDetailAction | null>(() => {
  const row = tables.selectedRow;
  const data = project.activeManifest;
  return data ? fileEditorActionForRow(data.modRoot, tables.currentTab, row) : null;
});

interface SchemaPreviewItem {
  display: string;
  key: string;
  kind: CsvColumnSchema['control'];
  label: string;
  meta: string;
  sprite: string;
  value: string;
  values: string[];
}

interface PreviewState {
  alt: string;
  detail: string;
  src: string;
  title: string;
}

const previewState = computed<PreviewState>(() => {
  const row = tables.selectedRow;
  if (!row) return noPreview(tables.currentTab);
  if (isCommentRow.value) return commentPreview();
  if (previewSrc.value) {
    return {
      alt: selectedDisplayId.value || MODULE_LABELS[tables.currentTab],
      detail: '',
      src: previewSrc.value,
      title: '',
    };
  }
  return noPreview(tables.currentTab);
});

watch(
  () => [project.activeManifest?.sessionId ?? '', tables.currentTab, tables.selectedRowKey],
  () => {
    void loadPreviewResource();
  },
  { immediate: true },
);

function noPreview(tab: TableKey): PreviewState {
  return {
    alt: MODULE_LABELS[tab],
    detail: `${MODULE_LABELS[tab]}当前没有可用缩略图。`,
    src: '',
    title: '无预览',
  };
}

function commentPreview(): PreviewState {
  return {
    alt: '注释行',
    detail: '该行不参与引用、预览或专用编辑器。',
    src: '',
    title: '注释行',
  };
}

async function loadPreviewResource() {
  previewSrc.value = '';
  const manifest = project.activeManifest;
  const row = tables.selectedRow;
  if (!manifest || !row || isCommentRow.value) return;
  const dataUrl = await queryTableRowPreviewDataUrl(manifest.sessionId, tables.currentTab, row);
  if (tables.selectedRow === row) previewSrc.value = dataUrl;
}

function schemaPreviewItem(schema: CsvColumnSchema, row: RowData): SchemaPreviewItem {
  const value = cell(row[schema.key]);
  const base: SchemaPreviewItem = {
    display: value,
    key: schema.key,
    kind: schema.control,
    label: schema.label ?? schema.key,
    meta: controlLabel(schema.control),
    sprite: '',
    value,
    values: [],
  };

  if (schema.control === 'reference') {
    const match = findSourceOption(schema.source, value);
    if (match.option) {
      base.display = match.option.label;
      base.meta = match.group ? `${controlLabel(schema.control)} · ${match.group}` : controlLabel(schema.control);
      base.sprite = match.option.sprite ?? '';
    }
    return base;
  }

  if (schema.control === 'tags' || schema.control === 'multi') {
    base.values = splitListValue(value);
    return base;
  }

  if (schema.control === 'enum') {
    base.meta = '枚举';
    return base;
  }

  if (schema.control === 'path-image') {
    base.meta = '图片路径';
    return base;
  }

  if (schema.control === 'boolean') {
    base.display = booleanLabel(value);
    return base;
  }

  return base;
}

function plainPreviewItem(column: string, row: RowData): SchemaPreviewItem {
  const value = cell(row[column]);
  return {
    display: value,
    key: column,
    kind: 'text',
    label: column,
    meta: '',
    sprite: '',
    value,
    values: [],
  };
}

function findSourceOption(source: string | undefined, value: string): { group: string; option: SelectOption | null } {
  if (!value) return { group: '', option: null };
  if (!source) return { group: '', option: null };
  return sourceValue(sourceIndex.value, source, value) ?? { group: '', option: null };
}

function splitListValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanLabel(value: string): string {
  if (!value) return '-';
  const normalized = value.toLowerCase();
  if (normalized === 'true') return 'true';
  if (normalized === 'false') return 'false';
  return value;
}

function controlLabel(control: CsvColumnSchema['control']): string {
  switch (control) {
    case 'number':
      return '数值';
    case 'boolean':
      return '布尔';
    case 'enum':
      return '枚举';
    case 'reference':
      return '引用';
    case 'tags':
      return '标签';
    case 'multi':
      return '多值';
    case 'path-image':
      return '图片路径';
    case 'color':
      return '颜色';
    default:
      return '文本';
  }
}
</script>
