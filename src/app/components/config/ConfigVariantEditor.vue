<template>
  <main v-if="selectedVariant && schema" class="variant-editor">
    <header class="variant-editor-header">
      <div>
        <h3>{{ selectedVariant.variantId }}</h3>
        <p>{{ selectedVariant.relPath }}</p>
      </div>
      <div class="variant-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteVariant">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>
    <div class="variant-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="localVariant" :runtime-context="schemaRuntimeContext" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { RowData, VariantFile } from '@/shared/types';
import { deepClone } from '@/shared/lib/starsector';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { createSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';

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

const localVariant = ref<RowData>({});
const saving = ref(false);

const schema = computed(() => getSchema('variant'));
const schemaRuntimeContext = computed(() =>
  props.modRoot && props.sessionId ? createSchemaRuntimeContext(props.modRoot, props.sessionId) : null,
);
const variants = computed(() => [...props.variants]);
const selectedVariant = computed(() => variants.value.find((variant) => variant.variantId === props.variantId) ?? null);

async function save() {
  const current = selectedVariant.value;
  const saveModRoot = props.modRoot;
  const saveSessionId = props.sessionId;
  if (!current || !saveModRoot || !saveSessionId) return;
  saving.value = true;
  try {
    const saved = await props.saveVariant(saveSessionId, saveModRoot, current, localVariant.value);
    if (props.modRoot !== saveModRoot || props.sessionId !== saveSessionId) return;
    if (!saved) return;
    localVariant.value = deepClone(saved.data);
    emit('saved', saved.variantId);
  } catch (error) {
    feedback.error(error, '保存装配失败');
  } finally {
    saving.value = false;
  }
}

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

watch(
  () => [props.variantId, props.dataRevision] as const,
  () => {
    const variant = selectedVariant.value;
    localVariant.value = variant ? deepClone(variant.data) : {};
  },
  { immediate: true },
);
</script>
