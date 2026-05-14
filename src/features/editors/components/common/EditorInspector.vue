<template>
  <aside class="editor-side">
    <div class="inspector-title">{{ title }}</div>
    <div class="editor-scroll">
      <slot />
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
