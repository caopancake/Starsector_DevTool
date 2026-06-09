<template>
  <header class="editor-header">
    <div class="editor-title">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </div>
    <div class="editor-draft-status" :class="{ dirty, external: Boolean(externalUpdateNotice) }">
      <span>{{ statusText }}</span>
      <button v-if="externalUpdateNotice" type="button" @click="$emit('load-external')">载入外部版本</button>
    </div>
    <slot />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ title: string; subtitle: string; dirty?: boolean; externalUpdateNotice?: string }>();
defineEmits<{ 'load-external': [] }>();

const statusText = computed(() => props.externalUpdateNotice || (props.dirty ? '未保存' : '已保存'));
</script>
