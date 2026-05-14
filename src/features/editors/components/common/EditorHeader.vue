<template>
  <header class="editor-header">
    <div class="editor-title">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </div>
    <slot />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>();
</script>
