<template>
  <aside class="variant-list config-entity-list">
    <header class="variant-list-header config-entity-list-header">
      <h3>装配列表</h3>
    </header>
    <ul class="variant-list-items config-entity-list-items">
      <li v-if="variants.length === 0" class="variant-list-empty config-entity-list-empty">未找到 data/variants 下的 .variant 文件。</li>
      <li
        v-for="variant in variants"
        :key="variant.variantId"
        class="variant-list-item config-entity-list-item"
        :class="{ active: variant.variantId === selectedId }"
        @click="emit('select', variant.variantId)"
      >
        <span class="variant-list-preview config-entity-thumb">
          <img v-if="variantShipSprite(variant)" :src="variantShipSprite(variant)" alt="" />
          <svg v-else class="variant-list-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5 18l7 3 7-3-7-15z" />
            <path d="M12 3v18M7 15l5 2 5-2" />
          </svg>
        </span>
        <span class="variant-list-text">
          <span class="config-entity-name">{{ variant.variantId }}</span>
          <small>{{ variant.hullId }}</small>
        </span>
        <n-button
          size="tiny"
          quaternary
          class="variant-delete-btn config-entity-delete compact-icon-button"
          title="删除装配"
          @click.stop="confirmDeleteVariant(variant)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </n-button>
      </li>
    </ul>
    <footer class="variant-list-footer config-entity-list-footer">
      <n-button size="small" block @click="showCreateDialog = true">新建装配</n-button>
    </footer>

    <n-modal
      v-model:show="showCreateDialog"
      preset="dialog"
      title="新建装配"
      positive-text="创建"
      negative-text="取消"
      @positive-click="createVariant"
    >
      <div class="variant-dialog-fields">
        <n-select
          v-model:value="newHullId"
          :options="hullOptions"
          :render-label="renderHullOptionLabel"
          filterable
          tag
          placeholder="hullId"
        />
        <n-input v-model:value="newVariantId" placeholder="variantId" />
      </div>
    </n-modal>

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deletePendingVariant"
    >
      <p>确定要删除装配 "{{ pendingDeleteVariant?.variantId }}" 吗？</p>
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { createAppFeedback } from '../../../app/app-feedback';
import { useProjectStore } from '../../project/project-store';
import type { VariantFile } from '../../../shared/types';
import { formatError } from '../../../shared/lib/errors';
import type { SelectOption } from '../../schema/schema-service';
import { resolveSource } from '../../schema/schema-service';
import { createVariantWithFileHistory, deleteVariantWithFileHistory } from '../config-save-orchestrator';
import { isSafeFileStem } from '../config-service';
import { resolveHullSprite } from '../../../shared/lib/hull-references';

const props = defineProps<{ selectedId: string }>();
const emit = defineEmits<{ select: [variantId: string] }>();

const project = useProjectStore();
const { message } = createAppFeedback(['message']);

const showCreateDialog = ref(false);
const newHullId = ref('');
const newVariantId = ref('');
const showDeleteDialog = ref(false);
const pendingDeleteVariant = ref<VariantFile | null>(null);

const modData = computed(() => project.activeModData);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const variants = computed(() => [...(modData.value?.variantFiles ?? [])].sort(compareVariants));
const hullOptions = computed(() => resolveSource('csv:ships.id', modData.value ?? null));

async function createVariant() {
  const hullId = newHullId.value.trim();
  const variantId = newVariantId.value.trim();
  if (!modRoot.value) return false;
  if (!hullId || !variantId) {
    message.warning('hullId 和 variantId 不能为空');
    return false;
  }
  if (!isSafeFileStem(variantId)) {
    message.error('variantId 不能包含路径分隔符或 ..');
    return false;
  }
  if (variants.value.some((variant) => variant.variantId === variantId)) {
    message.warning(`装配 "${variantId}" 已存在`);
    return false;
  }
  try {
    const result = await createVariantWithFileHistory(modRoot.value, hullId, variantId);
    project.upsertVariantFile(modRoot.value, result.variantFile);
    showCreateDialog.value = false;
    newHullId.value = '';
    newVariantId.value = '';
    emit('select', variantId);
    message.success(`装配 "${variantId}" 已创建`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function confirmDeleteVariant(variant: VariantFile) {
  pendingDeleteVariant.value = variant;
  showDeleteDialog.value = true;
}

async function deletePendingVariant() {
  const variant = pendingDeleteVariant.value;
  if (!variant || !modRoot.value) return false;
  try {
    await deleteVariantWithFileHistory(modRoot.value, variant.relPath, variant.variantId);
    project.deleteVariantFile(modRoot.value, variant.variantId);
    pendingDeleteVariant.value = null;
    showDeleteDialog.value = false;
    if (props.selectedId === variant.variantId) {
      emit('select', variants.value[0]?.variantId ?? '');
    }
    message.success(`装配 "${variant.variantId}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function compareVariants(a: VariantFile, b: VariantFile): number {
  return a.hullId.localeCompare(b.hullId) || a.variantId.localeCompare(b.variantId);
}

function variantShipSprite(variant: VariantFile): string {
  return resolveHullSprite(modData.value, variant.hullId);
}

function renderHullOptionLabel(option: SelectOption & { label?: string; value?: string; sprite?: string }) {
  if (!option.sprite) return option.label ?? option.value ?? '';
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, option.label ?? option.value ?? ''),
  ]);
}

watch(
  variants,
  (items) => {
    if (items.length === 0) {
      emit('select', '');
      return;
    }
    if (!items.some((variant) => variant.variantId === props.selectedId)) {
      emit('select', items[0].variantId);
    }
  },
  { immediate: true },
);
</script>
