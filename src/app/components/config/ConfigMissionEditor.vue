<template>
  <main v-if="schema" class="mission-editor">
    <header class="mission-editor-header">
      <h3>{{ editingMissionId || missionId }}</h3>
      <div class="config-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteMission">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>
    <div class="mission-editor-body">
      <div v-if="iconSrc" class="mission-icon-preview">
        <img :src="iconSrc" alt="" />
      </div>
      <SchemaFormRenderer :schema="schema" v-model="localMission" :runtime-context="schemaRuntimeContext" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import type { JsonValue, RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { aggregateSchemaSources, getSchema, splitSchemaSources } from '@/domain/schema/schema-registry';
import { getMissionEntity } from '@/services/config.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { buildMissionIndexRow, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { deleteIndexedConfigEntityWithFileHistory, saveIndexedConfigEntityWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{ missionId: string }>();
const emit = defineEmits<{ saved: [missionId: string] }>();

const project = useProjectStore();
const feedback = useAppFeedback();

const indexHeader = ref<string[]>(['mission']);
const localMission = ref<RowData>({});
const loadedMissionId = ref('');
const iconSrc = ref('');
const saving = ref(false);

const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
const schema = computed(() => getSchema('mission'));
const schemaRuntimeContext = computed(() =>
  project.activeManifest ? { modRoot: project.activeManifest.modRoot, sessionId: project.activeManifest.sessionId } : null,
);
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
  if (!modRoot.value || !sessionId.value || !props.missionId) return;
  try {
    const data = await getMissionEntity(sessionId.value, props.missionId);
    indexHeader.value = Object.keys(data.list).length ? Object.keys(data.list) : ['mission'];
    loadedMissionId.value = props.missionId;
    localMission.value = aggregateSchemaSources({
      list: data.list,
      descriptor: data.descriptor,
      text: data.text,
    });
    iconSrc.value = data.iconResourceRef ? ((await queryResourceDataUrlBatch(sessionId.value, [data.iconResourceRef]))[0] ?? '') : '';
  } catch (error) {
    feedback.error(error, '加载战役失败');
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
    feedback.warning('mission 不能为空');
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
    feedback.success(`战役 "${result.entityId}" 已保存`);
  } catch (error) {
    feedback.error(error, '保存战役失败');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteMission() {
  const id = loadedMissionId.value || props.missionId;
  feedback.confirmDanger({
    title: '删除战役',
    content: `确定要删除战役 "${id}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteCurrentMission();
    },
  });
}

async function deleteCurrentMission() {
  if (!modRoot.value || !loadedMissionId.value) return false;
  try {
    const deleted = loadedMissionId.value;
    await deleteIndexedConfigEntityWithFileHistory(modRoot.value, 'mission', deleted, true);
    loadedMissionId.value = '';
    localMission.value = {};
    iconSrc.value = '';
    emit('saved', '');
    feedback.success(`战役 "${deleted}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除战役失败');
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
