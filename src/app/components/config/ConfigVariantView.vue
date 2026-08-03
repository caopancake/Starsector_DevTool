<template>
  <div class="variant-view">
    <ConfigVariantList
      :selected-id="selectedVariantId"
      :variants="variants"
      :variant-sprites="variantSprites"
      :hull-options="hullOptions"
      :load-hull-options="loadHullOptions"
      :mod-root="modRoot"
      :session-id="sessionId"
      :create-variant="createVariant"
      :delete-variant="deleteVariant"
      @select="selectVariant"
    />
    <ConfigVariantEditor
      v-if="selectedVariantId"
      :key="selectedVariantId"
      :variant-id="selectedVariantId"
      :variants="variants"
      :mod-root="modRoot"
      :session-id="sessionId"
      :data-revision="variantDataRevision"
      :save-variant="saveVariant"
      :delete-variant="deleteVariant"
      @saved="onSaved"
    />
    <div v-else class="config-placeholder">
      <p>选择一个装配以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConfigVariantEditor from '@/app/components/config/ConfigVariantEditor.vue';
import ConfigVariantList from '@/app/components/config/ConfigVariantList.vue';
import { useDraftTransitionConfirmation } from '@/app/composables/use-draft-transition-confirmation';
import { useConfigVariantViewModel } from '@/app/composables/use-config-variant-view-model';

const {
  selectedVariantId,
  modRoot,
  sessionId,
  variants,
  variantSprites,
  hullOptions,
  loadHullOptions,
  variantDataRevision,
  createVariant,
  deleteVariant,
  onSaved,
  saveVariant,
} = useConfigVariantViewModel();
const { confirmDraftTransition } = useDraftTransitionConfirmation();

function selectVariant(variantId: string | null): void {
  const nextVariantId = variantId ?? '';
  if (nextVariantId === selectedVariantId.value) return;
  confirmDraftTransition(modRoot.value, {
    title: '切换装配？',
    content: '当前装配有未保存修改，切换后这些修改将丢失。确认继续？',
    action: () => {
      selectedVariantId.value = nextVariantId;
    },
  });
}
</script>
