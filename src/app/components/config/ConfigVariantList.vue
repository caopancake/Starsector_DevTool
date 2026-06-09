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
          <img v-if="props.variantSprites[variant.variantId]" :src="props.variantSprites[variant.variantId]" alt="" />
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
      <n-button size="small" block @click="openCreateDialog">新建装配</n-button>
    </footer>

    <n-modal
      v-model:show="showCreateDialog"
      preset="dialog"
      title="新建装配"
      positive-text="创建"
      negative-text="取消"
      @positive-click="submitCreateVariant"
    >
      <div class="variant-dialog-fields">
        <n-input v-if="settings.isPlainEditMode" v-model:value="newHullId" placeholder="hullId" />
        <n-select
          v-else
          v-model:value="newHullId"
          :options="props.hullOptions"
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
import { useSettingsStore } from '@/stores/settings.store';
import type { VariantFile } from '@/shared/types';
import { isSelectOptionGroup, selectOptionText, type SelectOption } from '@/domain/schema/schema-options';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{
  selectedId: string | null;
  variants: VariantFile[];
  variantSprites: Record<string, string>;
  hullOptions: SelectOption[];
  modRoot: string | null;
  sessionId: string | null;
  createVariant: (sessionId: string, modRoot: string, hullId: string, variantId: string) => Promise<boolean>;
  deleteVariant: (sessionId: string, modRoot: string, variant: Pick<VariantFile, 'relPath' | 'variantId'>) => Promise<boolean>;
}>();
const emit = defineEmits<{ select: [variantId: string | null] }>();

const settings = useSettingsStore();
const feedback = useAppFeedback();

const showCreateDialog = ref(false);
const newHullId = ref('');
const newVariantId = ref('');
const createModRoot = ref<string | null>(null);
const createSessionId = ref<string | null>(null);

const variants = computed(() => [...props.variants].sort(compareVariants));

function openCreateDialog() {
  createModRoot.value = props.modRoot;
  createSessionId.value = props.sessionId;
  if (!createModRoot.value || !createSessionId.value) return;
  showCreateDialog.value = true;
}

async function submitCreateVariant() {
  const targetModRoot = createModRoot.value;
  const targetSessionId = createSessionId.value;
  if (!targetModRoot || !targetSessionId) return false;
  const created = await props.createVariant(targetSessionId, targetModRoot, newHullId.value.trim(), newVariantId.value.trim());
  if (!created) {
    return false;
  }
  const variantId = newVariantId.value.trim();
  showCreateDialog.value = false;
  newHullId.value = '';
  newVariantId.value = '';
  if (props.modRoot === targetModRoot && props.sessionId === targetSessionId) emit('select', variantId);
  return true;
}

function confirmDeleteVariant(variant: VariantFile) {
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!deleteModRoot || !deleteSessionId) return;
  const deleteTarget = { relPath: variant.relPath, variantId: variant.variantId };
  feedback.confirmDanger({
    title: '删除装配',
    content: `确定要删除装配 "${deleteTarget.variantId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await props.deleteVariant(deleteSessionId, deleteModRoot, deleteTarget);
    },
  });
}

function compareVariants(a: VariantFile, b: VariantFile): number {
  return a.hullId.localeCompare(b.hullId) || a.variantId.localeCompare(b.variantId);
}

function renderHullOptionLabel(option: SelectOption) {
  if (isSelectOptionGroup(option)) return selectOptionText(option);
  if (!option.sprite) return selectOptionText(option);
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, selectOptionText(option)),
  ]);
}

watch(
  variants,
  (items) => {
    if (items.length === 0) {
      emit('select', null);
      return;
    }
    if (!items.some((variant) => variant.variantId === props.selectedId)) {
      emit('select', items[0].variantId);
    }
  },
  { immediate: true },
);
</script>
