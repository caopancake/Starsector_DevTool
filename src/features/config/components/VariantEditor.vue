<template>
  <main v-if="selectedVariant && schema" class="variant-editor">
    <header class="variant-editor-header">
      <div>
        <h3>{{ selectedVariant.variantId }}</h3>
        <p>{{ selectedVariant.relPath }}</p>
      </div>
      <div class="variant-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteVariant">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存装配</n-button>
      </div>
    </header>
    <div class="variant-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="localVariant" :app-data="project.activeModData" />
    </div>

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deleteCurrentVariant"
    >
      <p>确定要删除装配 "{{ selectedVariant.variantId }}" 吗？</p>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createAppFeedback } from '../../../app/app-feedback';
import { useProjectStore } from '../../project/project-store';
import type { RowData } from '../../../shared/types';
import { deepClone } from '../../../shared/lib/starsector';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { getSchema } from '../../schema/schema-service';
import { formatError } from '../../../shared/lib/errors';
import { deleteVariantWithFileHistory, saveVariantWithFileHistory } from '../config-save-orchestrator';
import { isSafeFileStem } from '../config-service';

const props = defineProps<{ variantId: string }>();
const emit = defineEmits<{ saved: [variantId: string] }>();

const project = useProjectStore();
const { message } = createAppFeedback(['message']);

const localVariant = ref<RowData>({});
const saving = ref(false);
const showDeleteDialog = ref(false);

const schema = computed(() => getSchema('variant'));
const modData = computed(() => project.activeModData);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const variants = computed(() => [...(modData.value?.variantFiles ?? [])]);
const selectedVariant = computed(() => variants.value.find((variant) => variant.variantId === props.variantId) ?? null);

async function save() {
  const current = selectedVariant.value;
  if (!current || !modRoot.value) return;
  const nextVariantId = stringField(localVariant.value, 'variantId');
  const nextHullId = stringField(localVariant.value, 'hullId');
  if (!nextVariantId || !nextHullId) {
    message.warning('variantId 和 hullId 不能为空');
    return;
  }
  if (!isSafeFileStem(nextVariantId)) {
    message.error('variantId 不能包含路径分隔符或 ..');
    return;
  }
  if (variants.value.some((variant) => variant.variantId === nextVariantId && variant.variantId !== current.variantId)) {
    message.warning(`装配 "${nextVariantId}" 已存在`);
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
    project.upsertVariantFile(modRoot.value, result.variantFile, current.variantId);
    localVariant.value = deepClone(result.variantFile.data);
    emit('saved', result.variantFile.variantId);
    message.success(`装配 "${result.variantFile.variantId}" 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

function confirmDeleteVariant() {
  showDeleteDialog.value = true;
}

async function deleteCurrentVariant() {
  const current = selectedVariant.value;
  if (!current || !modRoot.value) return false;
  try {
    await deleteVariantWithFileHistory(modRoot.value, current.relPath, current.variantId);
    project.deleteVariantFile(modRoot.value, current.variantId);
    showDeleteDialog.value = false;
    emit('saved', variants.value[0]?.variantId ?? '');
    message.success(`装配 "${current.variantId}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
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
