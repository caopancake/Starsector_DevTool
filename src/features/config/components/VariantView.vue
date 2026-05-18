<template>
  <div class="variant-view">
    <VariantEntityList :selected-id="selectedVariantId" @select="selectedVariantId = $event" />
    <VariantEditor v-if="selectedVariantId" :key="selectedVariantId" :variant-id="selectedVariantId" @saved="selectedVariantId = $event" />
    <div v-else class="config-placeholder">
      <p>选择一个装配以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VariantEditor from './VariantEditor.vue';
import VariantEntityList from './VariantEntityList.vue';

const selectedVariantId = ref('');
</script>
