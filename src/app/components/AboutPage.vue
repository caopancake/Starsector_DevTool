<template>
  <div class="settings-page">
    <!-- eslint-disable-next-line vue/no-v-html -- content from bundled static .md file, not user input -->
    <div class="about-content" v-html="htmlContent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import aboutRaw from '../../../ABOUT.md?raw';

const htmlContent = computed(() => marked(aboutRaw) as string);
</script>

<style scoped>
.about-content {
  padding: 1.5rem;
  line-height: 1.7;
  color: var(--text-color-1);
}

.about-content :deep(h1) {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.about-content :deep(h2) {
  font-size: 1.2rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3rem;
}

.about-content :deep(h3) {
  font-size: 1rem;
  margin-top: 1.2rem;
  margin-bottom: 0.3rem;
}

.about-content :deep(p) {
  margin: 0.5rem 0;
}

.about-content :deep(ul) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.about-content :deep(li) {
  margin: 0.25rem 0;
}

.about-content :deep(a) {
  color: var(--primary-color);
  text-decoration: none;
}

.about-content :deep(a:hover) {
  text-decoration: underline;
}

.about-content :deep(strong) {
  color: var(--text-color-1);
}

.about-content :deep(code) {
  background: var(--code-color);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9em;
}
</style>
