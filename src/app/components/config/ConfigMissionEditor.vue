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
import type { ConfigMissionEditorData, RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { configMissionEditingId, configMissionEditorModel, configMissionSaveDraft } from '@/domain/config/config-entities';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { createSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';
import type { FileSchema } from '@/domain/schema/schema.types';

const props = defineProps<{
  missionId: string;
  modRoot: string | null;
  sessionId: string | null;
  editorReloadToken: number;
  iconRefreshToken: number;
  queryMissionEditorData: (sessionId: string, id: string) => Promise<ConfigMissionEditorData | null>;
  saveMission: (sessionId: string, modRoot: string, previousId: string, localMission: RowData, schema: FileSchema) => Promise<string>;
  deleteMission: (sessionId: string, modRoot: string, id: string, deleteDirectory: boolean) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [missionId: string | null] }>();

const feedback = useAppFeedback();

const indexHeader = ref<string[]>(['mission']);
const localMission = ref<RowData>({});
const loadedMissionId = ref<string | null>(null);
const iconSrc = ref('');
const saving = ref(false);
let editorRequestId = 0;
let iconRequestId = 0;

const modRoot = computed(() => props.modRoot);
const sessionId = computed(() => props.sessionId);
const schema = computed(() => getSchema('mission'));
const schemaRuntimeContext = computed(() =>
  props.modRoot && props.sessionId ? createSchemaRuntimeContext(props.modRoot, props.sessionId) : null,
);
const editingMissionId = computed(() => configMissionEditingId(localMission.value));

async function loadConfigMissionEditor() {
  const requestId = ++editorRequestId;
  const missionId = props.missionId;
  const targetSessionId = sessionId.value;
  localMission.value = {};
  loadedMissionId.value = null;
  iconSrc.value = '';
  if (!modRoot.value || !targetSessionId || !missionId) return;
  try {
    const data = await props.queryMissionEditorData(targetSessionId, missionId);
    if (requestId !== editorRequestId || targetSessionId !== sessionId.value || missionId !== props.missionId) return;
    if (!data) return;
    const model = configMissionEditorModel(data);
    indexHeader.value = model.indexHeader;
    loadedMissionId.value = props.missionId;
    localMission.value = model.localMission;
    iconSrc.value = model.iconSrc;
  } catch (error) {
    feedback.error(error, '加载战役失败');
  }
}

async function refreshMissionIcon() {
  const requestId = ++iconRequestId;
  const missionId = loadedMissionId.value;
  const targetSessionId = sessionId.value;
  if (!modRoot.value || !targetSessionId || !missionId) return;
  try {
    const data = await props.queryMissionEditorData(targetSessionId, missionId);
    if (requestId !== iconRequestId || targetSessionId !== sessionId.value || missionId !== loadedMissionId.value) return;
    iconSrc.value = data?.iconSrc ?? '';
  } catch (error) {
    feedback.error(error, '刷新战役图标失败');
  }
}

async function save() {
  if (!modRoot.value || !loadedMissionId.value || !schema.value) return;
  const saveModRoot = modRoot.value;
  const saveSessionId = sessionId.value;
  if (!saveSessionId) return;
  const draft = configMissionSaveDraft(localMission.value, schema.value);
  if (!draft.nextId) {
    feedback.warning('mission 不能为空');
    return;
  }
  saving.value = true;
  try {
    const savedId = await props.saveMission(saveSessionId, saveModRoot, loadedMissionId.value, localMission.value, schema.value);
    if (modRoot.value !== saveModRoot || sessionId.value !== saveSessionId) return;
    loadedMissionId.value = savedId;
    localMission.value = configMissionEditorModel({
      list: draft.list,
      descriptor: draft.descriptor,
      text: draft.text,
      iconSrc: iconSrc.value,
    }).localMission;
    emit('saved', savedId);
  } catch (error) {
    feedback.error(error, '保存战役失败');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteMission() {
  const id = loadedMissionId.value ?? props.missionId;
  const deleteModRoot = modRoot.value;
  const deleteSessionId = sessionId.value;
  if (!deleteModRoot || !deleteSessionId || !id) return;
  feedback.confirmDanger({
    title: '删除战役',
    content: `确定要删除战役 "${id}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteMissionTarget(deleteSessionId, deleteModRoot, id);
    },
  });
}

async function deleteMissionTarget(deleteSessionId: string, deleteModRoot: string, id: string) {
  try {
    await props.deleteMission(deleteSessionId, deleteModRoot, id, true);
    if (modRoot.value !== deleteModRoot || sessionId.value !== deleteSessionId) return true;
    loadedMissionId.value = null;
    localMission.value = {};
    iconSrc.value = '';
    emit('saved', null);
  } catch (error) {
    feedback.error(error, '删除战役失败');
    return false;
  }
  return true;
}

watch(() => [props.missionId, modRoot.value, props.editorReloadToken] as const, loadConfigMissionEditor, { immediate: true });
watch(() => props.iconRefreshToken, refreshMissionIcon);
</script>
