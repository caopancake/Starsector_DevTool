<template>
  <footer class="editor-footer">
    <span v-if="note">{{ note }}</span>
    <slot />
    <div v-if="$slots.actions" class="editor-footer-actions">
      <slot name="actions" />
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{ note?: string }>();
</script>
