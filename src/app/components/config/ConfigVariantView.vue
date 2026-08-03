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
      @select="selectedVariantId = $event"
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
</script>
