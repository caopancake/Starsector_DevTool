<template>
  <main v-if="schema" class="mission-editor">
    <header class="mission-editor-header">
      <h3>{{ editingMissionId || missionId }}</h3>
      <div class="config-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteMission">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存战役</n-button>
      </div>
    </header>
    <div class="mission-editor-body">
      <div v-if="iconSrc" class="mission-icon-preview">
        <img :src="iconSrc" alt="" />
      </div>
      <SchemaFormRenderer :schema="schema" v-model="localMission" :app-data="project.activeModData" />
    </div>

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deleteCurrentMission"
    >
      <p>确定要删除战役 "{{ loadedMissionId || missionId }}" 吗？</p>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import { loadImageDataUrl } from '@/services/assets.service';
import { formatError } from '@/shared/lib/errors';
import type { JsonValue, RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { aggregateSchemaSources, getSchema, splitSchemaSources } from '@/domain/schema/schema-registry';
import { loadMission, loadMissionList, scanMissionListFiles } from '@/services/config.service';
import { buildMissionIndexRow, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { deleteIndexedConfigEntityWithFileHistory, saveIndexedConfigEntityWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { createAppFeedback } from '@/app/app-feedback';

const props = defineProps<{ missionId: string }>();
const emit = defineEmits<{ saved: [missionId: string] }>();

const project = useProjectStore();
const settings = useSettingsStore();
const { message } = createAppFeedback(['message']);

const DEFAULT_MISSION_LIST_PATH = 'data/missions/mission_list.csv';

const missionListPath = ref(DEFAULT_MISSION_LIST_PATH);
const indexHeader = ref<string[]>(['mission']);
const localMission = ref<RowData>({});
const loadedMissionId = ref('');
const iconSrc = ref('');
const saving = ref(false);
const showDeleteDialog = ref(false);

const modRoot = computed(() => project.activeModData?.modRoot ?? null);
const schema = computed(() => getSchema('mission'));
const editingMissionId = computed(() => {
  const list = localMission.value.list;
  return list && typeof list === 'object' && !Array.isArray(list) ? missionIdFromRow(list as RowData) : '';
});

function cellValue(value: JsonValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function missionIdFromRow(row: RowData): string {
  return cellValue(row.mission).trim();
}

async function loadConfigMissionEditor() {
  localMission.value = {};
  loadedMissionId.value = '';
  iconSrc.value = '';
  if (!modRoot.value || !props.missionId) return;
  try {
    const files = await scanMissionListFiles(modRoot.value);
    missionListPath.value = files[0] ?? DEFAULT_MISSION_LIST_PATH;
    const table = files[0]
      ? await loadMissionList(modRoot.value, missionListPath.value)
      : { header: ['mission'], path: DEFAULT_MISSION_LIST_PATH, rows: [] };
    indexHeader.value = table.header.length ? table.header : ['mission'];
    const row = table.rows.find((item) => missionIdFromRow(item) === props.missionId) ?? { mission: props.missionId };
    const data = await loadMission(modRoot.value, props.missionId);
    loadedMissionId.value = props.missionId;
    localMission.value = aggregateSchemaSources({
      list: row,
      descriptor: data.descriptor,
      text: data.text,
    });
    if (data.iconPath) {
      const coreRoot = settings.starsectorRoot || project.activeModData?.starsectorRoot || undefined;
      iconSrc.value = (await loadImageDataUrl(modRoot.value, data.iconPath, coreRoot)) ?? '';
    }
  } catch (error) {
    message.error(formatError(error));
  }
}

async function save() {
  if (!modRoot.value || !loadedMissionId.value || !schema.value) return;
  const split = splitSchemaSources(localMission.value, schema.value);
  const list = requireObjectSource(split.list, '战役列表项数据无效');
  const descriptor = requireObjectSource(split.descriptor, 'descriptor.json 数据无效');
  const text = requireTextSource(split.text, 'mission_text.txt 数据无效');
  const nextId = missionIdFromRow(list);
  if (!nextId) {
    message.warning('mission 不能为空');
    return;
  }
  saving.value = true;
  try {
    const idChanged = loadedMissionId.value !== nextId;
    const result = await saveIndexedConfigEntityWithFileHistory({
      modRoot: modRoot.value,
      kind: 'mission',
      previousId: idChanged ? loadedMissionId.value : null,
      nextId,
      indexRow: buildMissionIndexRow([list], indexHeader.value, nextId),
      payload: {
        descriptor: stripSchemaInternalFields(descriptor) as RowData,
        text,
      },
      deletePreviousTarget: idChanged,
    });
    indexHeader.value = result.indexHeader;
    loadedMissionId.value = result.entityId;
    localMission.value = aggregateSchemaSources({
      list: result.indexRows.find((row) => missionIdFromRow(row) === result.entityId) ?? list,
      descriptor,
      text,
    });
    emit('saved', result.entityId);
    message.success(`${result.entityId} 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

function confirmDeleteMission() {
  showDeleteDialog.value = true;
}

async function deleteCurrentMission() {
  if (!modRoot.value || !loadedMissionId.value) return false;
  try {
    const deleted = loadedMissionId.value;
    await deleteIndexedConfigEntityWithFileHistory(modRoot.value, 'mission', deleted, true);
    showDeleteDialog.value = false;
    loadedMissionId.value = '';
    localMission.value = {};
    iconSrc.value = '';
    emit('saved', '');
    message.success(`战役 "${deleted}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function requireObjectSource(value: unknown, errorMessage: string): RowData {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as RowData;
  throw new Error(errorMessage);
}

function requireTextSource(value: unknown, errorMessage: string): string {
  if (typeof value === 'string') return value;
  throw new Error(errorMessage);
}

watch(() => [props.missionId, modRoot.value], loadConfigMissionEditor, { immediate: true });
</script>
