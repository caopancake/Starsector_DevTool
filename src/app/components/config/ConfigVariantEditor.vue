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

const props = defineProps<{
  variantId: string;
  variants: VariantFile[];
  saveVariant: (current: VariantFile, data: RowData) => Promise<VariantFile | null>;
  deleteVariant: (variant: VariantFile) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [variantId: string] }>();

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
  saving.value = true;
  try {
    const saved = await props.saveVariant(current, localVariant.value);
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
    if (!(await props.deleteVariant(current))) return false;
    const nextId = variants.value.find((variant) => variant.variantId !== current.variantId)?.variantId ?? '';
    emit('saved', nextId);
  } catch (error) {
    feedback.error(error, '删除装配失败');
    return false;
  }
  return true;
}

watch(
  selectedVariant,
  (variant) => {
    localVariant.value = variant ? deepClone(variant.data) : {};
  },
  { immediate: true },
);
</script>
