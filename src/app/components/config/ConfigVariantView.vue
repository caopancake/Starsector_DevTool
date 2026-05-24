<template>
  <div class="variant-view">
    <ConfigVariantList
      :selected-id="selectedVariantId"
      :variants="variants"
      :variant-sprites="variantSprites"
      :hull-options="hullOptions"
      :create-variant="createVariant"
      :delete-variant="deleteVariant"
      @select="selectedVariantId = $event"
    />
    <ConfigVariantEditor
      v-if="selectedVariantId"
      :key="selectedVariantId"
      :variant-id="selectedVariantId"
      :variants="variants"
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

const { selectedVariantId, variants, variantSprites, hullOptions, createVariant, deleteVariant, onSaved, saveVariant } =
  useConfigVariantViewModel();
</script>
