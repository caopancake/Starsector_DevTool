<template>
  <div class="variant-view">
    <ConfigVariantList :selected-id="selectedVariantId" @select="selectedVariantId = $event" />
    <ConfigVariantEditor
      v-if="selectedVariantId"
      :key="selectedVariantId"
      :variant-id="selectedVariantId"
      @saved="selectedVariantId = $event"
    />
    <div v-else class="config-placeholder">
      <p>选择一个装配以编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ConfigVariantEditor from '@/app/components/config/ConfigVariantEditor.vue';
import ConfigVariantList from '@/app/components/config/ConfigVariantList.vue';

const selectedVariantId = ref('');
</script>
