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
import { useProjectStore } from '@/stores/project.store';
import type { RowData, VariantFile } from '@/shared/types';
import { deepClone } from '@/shared/lib/starsector';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { deleteVariantWithFileHistory, saveVariantWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { isSafeEntityFileStem } from '@/domain/config/config-entities';

const props = defineProps<{ variantId: string; variants: VariantFile[] }>();
const emit = defineEmits<{ saved: [variantId: string]; changed: [] }>();

const project = useProjectStore();
const feedback = useAppFeedback();

const localVariant = ref<RowData>({});
const saving = ref(false);

const schema = computed(() => getSchema('variant'));
const schemaRuntimeContext = computed(() =>
  project.activeManifest ? { modRoot: project.activeManifest.modRoot, sessionId: project.activeManifest.sessionId } : null,
);
const modData = computed(() => project.activeManifest);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const variants = computed(() => [...props.variants]);
const selectedVariant = computed(() => variants.value.find((variant) => variant.variantId === props.variantId) ?? null);

async function save() {
  const current = selectedVariant.value;
  if (!current || !modRoot.value) return;
  const nextVariantId = stringField(localVariant.value, 'variantId');
  const nextHullId = stringField(localVariant.value, 'hullId');
  if (!nextVariantId || !nextHullId) {
    feedback.warning('variantId 和 hullId 不能为空');
    return;
  }
  if (!isSafeEntityFileStem(nextVariantId)) {
    feedback.error('variantId 不能包含路径分隔符或 ..');
    return;
  }
  if (variants.value.some((variant) => variant.variantId === nextVariantId && variant.variantId !== current.variantId)) {
    feedback.warning(`装配 "${nextVariantId}" 已存在`);
    return;
  }
  saving.value = true;
  try {
    const renamed = nextVariantId !== current.variantId;
    const result = await saveVariantWithFileHistory(
      modRoot.value,
      nextVariantId,
      localVariant.value,
      renamed ? current.variantId : null,
      renamed ? current.relPath : null,
    );
    emit('changed');
    localVariant.value = deepClone(result.variantFile.data);
    emit('saved', result.variantFile.variantId);
    feedback.success(`装配 "${result.variantFile.variantId}" 已保存`);
  } catch (error) {
    feedback.error(error, '保存装配失败');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteVariant() {
  const current = selectedVariant.value;
  if (!current) return;
  feedback.confirmDanger({
    title: '删除装配',
    content: `确定要删除装配 "${current.variantId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteCurrentVariant();
    },
  });
}

async function deleteCurrentVariant() {
  const current = selectedVariant.value;
  if (!current || !modRoot.value) return false;
  try {
    await deleteVariantWithFileHistory(modRoot.value, current.relPath, current.variantId);
    emit('changed');
    emit('saved', variants.value[0]?.variantId ?? '');
    feedback.success(`装配 "${current.variantId}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除装配失败');
    return false;
  }
  return true;
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

watch(
  selectedVariant,
  (variant) => {
    localVariant.value = variant ? deepClone(variant.data) : {};
  },
  { immediate: true },
);
</script>
