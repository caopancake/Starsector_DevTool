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
          <img v-if="variantSprites[variant.variantId]" :src="variantSprites[variant.variantId]" alt="" />
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
        <n-input v-if="settings.isPlainEditMode" v-model:value="newHullId" placeholder="hullId" />
        <n-select
          v-else
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
  </aside>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { VariantFile } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-registry';
import { createVariantWithFileHistory, deleteVariantWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { isSafeEntityFileStem } from '@/domain/config/config-entities';
import { queryHullPreviewSprites, queryHullReferenceOptions } from '@/services/config.service';

const props = defineProps<{ selectedId: string; variants: VariantFile[] }>();
const emit = defineEmits<{ select: [variantId: string]; changed: [] }>();

const project = useProjectStore();
const feedback = useAppFeedback();
const settings = useSettingsStore();

const showCreateDialog = ref(false);
const newHullId = ref('');
const newVariantId = ref('');
const pendingDeleteVariant = ref<VariantFile | null>(null);
const hullOptions = ref<SelectOption[]>([]);
const variantSprites = ref<Record<string, string>>({});

const modData = computed(() => project.activeManifest);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const sessionId = computed(() => modData.value?.sessionId ?? '');
const variants = computed(() => [...props.variants].sort(compareVariants));

async function createVariant() {
  const hullId = newHullId.value.trim();
  const variantId = newVariantId.value.trim();
  if (!modRoot.value) return false;
  if (!hullId || !variantId) {
    feedback.warning('hullId 和 variantId 不能为空');
    return false;
  }
  if (!isSafeEntityFileStem(variantId)) {
    feedback.error('variantId 不能包含路径分隔符或 ..');
    return false;
  }
  if (variants.value.some((variant) => variant.variantId === variantId)) {
    feedback.warning(`装配 "${variantId}" 已存在`);
    return false;
  }
  try {
    await createVariantWithFileHistory(modRoot.value, hullId, variantId);
    emit('changed');
    showCreateDialog.value = false;
    newHullId.value = '';
    newVariantId.value = '';
    emit('select', variantId);
    feedback.success(`装配 "${variantId}" 已创建`);
  } catch (error) {
    feedback.error(error, '创建装配失败');
    return false;
  }
  return true;
}

function confirmDeleteVariant(variant: VariantFile) {
  pendingDeleteVariant.value = variant;
  feedback.confirmDanger({
    title: '删除装配',
    content: `确定要删除装配 "${variant.variantId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deletePendingVariant();
    },
  });
}

async function deletePendingVariant() {
  const variant = pendingDeleteVariant.value;
  if (!variant || !modRoot.value) return false;
  try {
    await deleteVariantWithFileHistory(modRoot.value, variant.relPath, variant.variantId);
    emit('changed');
    pendingDeleteVariant.value = null;
    if (props.selectedId === variant.variantId) {
      emit('select', variants.value[0]?.variantId ?? '');
    }
    feedback.success(`装配 "${variant.variantId}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除装配失败');
    return false;
  }
  return true;
}

function compareVariants(a: VariantFile, b: VariantFile): number {
  return a.hullId.localeCompare(b.hullId) || a.variantId.localeCompare(b.variantId);
}

function renderHullOptionLabel(option: SelectOption) {
  if (option.type === 'group') return option.label;
  if (!option.sprite) return option.label ?? option.value ?? '';
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, option.label ?? option.value ?? ''),
  ]);
}

async function loadHullOptions() {
  if (!sessionId.value || settings.isPlainEditMode) {
    hullOptions.value = [];
    return;
  }
  try {
    hullOptions.value = await queryHullReferenceOptions(sessionId.value);
  } catch (error) {
    feedback.error(error, '读取舰船引用失败');
  }
}

async function loadVariantSprites() {
  if (!sessionId.value || variants.value.length === 0) {
    variantSprites.value = {};
    return;
  }
  try {
    const spritesByHull = await queryHullPreviewSprites(
      sessionId.value,
      variants.value.map((variant) => variant.hullId),
    );
    variantSprites.value = Object.fromEntries(variants.value.map((variant) => [variant.variantId, spritesByHull[variant.hullId] ?? '']));
  } catch (error) {
    feedback.error(error, '读取装配缩略图失败');
  }
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

watch([showCreateDialog, sessionId, () => settings.isPlainEditMode], () => void loadHullOptions(), { immediate: true });
watch([variants, sessionId], () => void loadVariantSprites(), { immediate: true });
</script>
