<template>
  <main v-if="selectedVariant && schema" class="variant-editor">
    <header class="variant-editor-header">
      <div>
        <h3>{{ selectedVariant.variantId }}</h3>
        <p>{{ selectedVariant.relPath }}</p>
      </div>
      <div class="variant-editor-actions">
        <n-button v-if="hasPendingExternalData" size="small" secondary type="warning" @click="loadPendingExternalData">
          载入外部版本
        </n-button>
        <n-button size="small" secondary type="error" @click="confirmDeleteVariant">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>
    <div v-if="externalUpdateNotice" class="config-external-update-note">{{ externalUpdateNotice }}</div>
    <div class="variant-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="draftData" :runtime-context="schemaRuntimeContext" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, toRef } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { RowData, VariantFile } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { createSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';
import { useConfigVariantEditorViewModel } from '@/app/composables/use-config-variant-editor-view-model';
import { registerActiveSaveHandler, unregisterActiveSaveHandler } from '@/shared/lib/save-command-registry';

const props = defineProps<{
  variantId: string;
  variants: VariantFile[];
  modRoot: string | null;
  sessionId: string | null;
  dataRevision: number;
  saveVariant: (sessionId: string, modRoot: string, current: VariantFile, data: RowData) => Promise<VariantFile | null>;
  deleteVariant: (sessionId: string, modRoot: string, variant: Pick<VariantFile, 'relPath' | 'variantId'>) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [variantId: string | null] }>();

const feedback = useAppFeedback();

const schema = computed(() => getSchema('variant'));
const schemaRuntimeContext = computed(() =>
  props.modRoot && props.sessionId ? createSchemaRuntimeContext(props.modRoot, props.sessionId) : null,
);
const variants = computed(() => [...props.variants]);
const { draftData, externalUpdateNotice, hasPendingExternalData, loadPendingExternalData, save, saving, selectedVariant } =
  useConfigVariantEditorViewModel({
    dataRevision: toRef(props, 'dataRevision'),
    modRoot: toRef(props, 'modRoot'),
    onSaved: (variantId) => emit('saved', variantId),
    saveVariant: props.saveVariant,
    sessionId: toRef(props, 'sessionId'),
    variantId: toRef(props, 'variantId'),
    variants,
  });

function confirmDeleteVariant() {
  const current = selectedVariant.value;
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!current || !deleteModRoot || !deleteSessionId) return;
  const deleteTarget = { relPath: current.relPath, variantId: current.variantId };
  feedback.confirmDanger({
    title: '删除装配',
    content: `确定要删除装配 "${deleteTarget.variantId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteVariantTarget(deleteSessionId, deleteModRoot, deleteTarget);
    },
  });
}

async function deleteVariantTarget(deleteSessionId: string, deleteModRoot: string, current: Pick<VariantFile, 'relPath' | 'variantId'>) {
  try {
    if (!(await props.deleteVariant(deleteSessionId, deleteModRoot, current))) return false;
    if (props.modRoot !== deleteModRoot || props.sessionId !== deleteSessionId) return true;
    const nextId = variants.value.find((variant) => variant.variantId !== current.variantId)?.variantId ?? null;
    emit('saved', nextId);
  } catch (error) {
    feedback.error(error, '删除装配失败');
    return false;
  }
  return true;
}

onMounted(() => registerActiveSaveHandler(save));
onUnmounted(() => unregisterActiveSaveHandler(save));
</script>
