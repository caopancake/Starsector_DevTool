<template>
  <main v-if="selectedSkin && schema" class="skin-editor">
    <header class="skin-editor-header">
      <div>
        <h3>{{ selectedSkin.skinHullId }}</h3>
        <p>{{ selectedSkin.relPath }}</p>
      </div>
      <div class="skin-editor-actions">
        <n-button v-if="hasPendingExternalData" size="small" secondary type="warning" @click="loadPendingExternalData">
          载入外部版本
        </n-button>
        <n-button size="small" secondary type="error" @click="confirmDeleteSkin">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>
    <div v-if="externalUpdateNotice" class="config-external-update-note">{{ externalUpdateNotice }}</div>
    <div class="skin-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="draftData" :runtime-context="schemaRuntimeContext" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, toRef } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { RowData, SkinFile } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { createSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';
import { useConfigSkinEditorViewModel } from '@/app/composables/use-config-skin-editor-view-model';
import { registerActiveSaveHandler, unregisterActiveSaveHandler } from '@/shared/lib/save-command-registry';

const props = defineProps<{
  skinHullId: string;
  skins: SkinFile[];
  modRoot: string | null;
  sessionId: string | null;
  dataRevision: number;
  saveSkin: (sessionId: string, modRoot: string, current: SkinFile, data: RowData) => Promise<SkinFile | null>;
  deleteSkin: (sessionId: string, modRoot: string, skin: Pick<SkinFile, 'relPath' | 'skinHullId'>) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [skinHullId: string | null] }>();

const feedback = useAppFeedback();

const schema = computed(() => getSchema('skin'));
const schemaRuntimeContext = computed(() =>
  props.modRoot && props.sessionId ? createSchemaRuntimeContext(props.modRoot, props.sessionId) : null,
);
const skins = computed(() => [...props.skins]);
const { draftData, externalUpdateNotice, hasPendingExternalData, loadPendingExternalData, save, saving, selectedSkin } =
  useConfigSkinEditorViewModel({
    dataRevision: toRef(props, 'dataRevision'),
    modRoot: toRef(props, 'modRoot'),
    onSaved: (skinHullId) => emit('saved', skinHullId),
    saveSkin: props.saveSkin,
    sessionId: toRef(props, 'sessionId'),
    skinHullId: toRef(props, 'skinHullId'),
    skins,
  });

function confirmDeleteSkin() {
  const current = selectedSkin.value;
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!current || !deleteModRoot || !deleteSessionId) return;
  const deleteTarget = { relPath: current.relPath, skinHullId: current.skinHullId };
  feedback.confirmDanger({
    title: '删除舰船皮肤',
    content: `确定要删除舰船皮肤 "${deleteTarget.skinHullId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteSkinTarget(deleteSessionId, deleteModRoot, deleteTarget);
    },
  });
}

async function deleteSkinTarget(deleteSessionId: string, deleteModRoot: string, current: Pick<SkinFile, 'relPath' | 'skinHullId'>) {
  try {
    if (!(await props.deleteSkin(deleteSessionId, deleteModRoot, current))) return false;
    if (props.modRoot !== deleteModRoot || props.sessionId !== deleteSessionId) return true;
    const nextId = skins.value.find((skin) => skin.skinHullId !== current.skinHullId)?.skinHullId ?? null;
    emit('saved', nextId);
  } catch (error) {
    feedback.error(error, '删除舰船皮肤失败');
    return false;
  }
  return true;
}

onMounted(() => registerActiveSaveHandler(save));
onUnmounted(() => unregisterActiveSaveHandler(save));
</script>
