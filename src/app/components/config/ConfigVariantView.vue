<template>
  <div class="variant-view">
    <ConfigVariantList :selected-id="selectedVariantId" :variants="variants" @select="selectedVariantId = $event" @changed="loadVariants" />
    <ConfigVariantEditor
      v-if="selectedVariantId"
      :key="selectedVariantId"
      :variant-id="selectedVariantId"
      :variants="variants"
      @saved="selectedVariantId = $event"
      @changed="loadVariants"
    />
    <div v-else class="config-placeholder">
      <p>选择一个装配以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ConfigVariantEditor from '@/app/components/config/ConfigVariantEditor.vue';
import ConfigVariantList from '@/app/components/config/ConfigVariantList.vue';
import { listVariantEntities } from '@/services/config.service';
import { useProjectStore } from '@/stores/project.store';
import type { VariantFile } from '@/shared/types';

const selectedVariantId = ref('');
const variants = ref<VariantFile[]>([]);
const project = useProjectStore();

async function loadVariants() {
  const sessionId = project.activeSessionId;
  if (!sessionId) {
    variants.value = [];
    return;
  }
  variants.value = await listVariantEntities(sessionId);
}

watch(() => project.activeSessionId, loadVariants, { immediate: true });
</script>
