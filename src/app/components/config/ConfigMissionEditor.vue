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
import type { EntityData, JsonValue, RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { aggregateSchemaSources, getSchema, splitSchemaSources } from '@/domain/schema/schema-registry';
import { stripSchemaInternalFields } from '@/domain/config/config-entities';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{
  missionId: string;
  modRoot: string | null;
  sessionId: string | null;
  queryMission: (id: string) => Promise<EntityData | null>;
  queryMissionIcon: (id: string) => Promise<string>;
  saveMission: (id: string, list: RowData, descriptor: RowData, text: string, previousId: string) => Promise<string>;
  deleteMission: (id: string, deleteDirectory: boolean) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [missionId: string] }>();

const feedback = useAppFeedback();

const indexHeader = ref<string[]>(['mission']);
const localMission = ref<RowData>({});
const loadedMissionId = ref('');
const iconSrc = ref('');
const saving = ref(false);

const modRoot = computed(() => props.modRoot);
const sessionId = computed(() => props.sessionId);
const schema = computed(() => getSchema('mission'));
const schemaRuntimeContext = computed(() =>
  props.modRoot && props.sessionId ? { modRoot: props.modRoot, sessionId: props.sessionId } : null,
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

function asRowData(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}

async function loadConfigMissionEditor() {
  localMission.value = {};
  loadedMissionId.value = '';
  iconSrc.value = '';
  if (!modRoot.value || !sessionId.value || !props.missionId) return;
  try {
    const data = await props.queryMission(props.missionId);
    if (!data) return;
    const missionData = asRowData(data.data);
    const list = asRowData(missionData.list);
    const descriptor = asRowData(missionData.descriptor);
    indexHeader.value = Object.keys(list).length ? Object.keys(list) : ['mission'];
    loadedMissionId.value = props.missionId;
    localMission.value = aggregateSchemaSources({
      list,
      descriptor,
      text: missionData.text,
    });
    iconSrc.value = await props.queryMissionIcon(props.missionId);
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
    const savedId = await props.saveMission(nextId, list, stripSchemaInternalFields(descriptor) as RowData, text, loadedMissionId.value);
    loadedMissionId.value = savedId;
    localMission.value = aggregateSchemaSources({
      list,
      descriptor,
      text,
    });
    emit('saved', savedId);
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
  if (!loadedMissionId.value) return false;
  try {
    const deleted = loadedMissionId.value;
    await props.deleteMission(deleted, true);
    loadedMissionId.value = '';
    localMission.value = {};
    iconSrc.value = '';
    emit('saved', '');
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
