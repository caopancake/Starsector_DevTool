<template>
  <div class="settings-page">
    <section class="settings-section about-summary">
      <h3>Starsector DevTool</h3>
      <div class="about-meta">
        <div>
          <span>当前版本</span>
          <strong>0.1.0</strong>
        </div>
        <div>
          <span>作者</span>
          <strong>cake、AnyIDElse</strong>
        </div>
      </div>
    </section>

    <section class="settings-section about-changelog">
      <h3>更新内容</h3>
      <!-- eslint-disable-next-line vue/no-v-html -- content from bundled static .md file, not user input -->
      <div class="about-content" v-html="changelogHtml" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import changelogRaw from '../../../CHANGELOG.md?raw';

const changelogHtml = computed(() => marked(changelogRaw) as string);
</script>

<style scoped>
.about-summary,
.about-changelog {
  width: min(760px, 100%);
}

.about-meta {
  display: grid;
  gap: 8px;
}

.about-meta > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  font-size: 13px;
}

.about-meta span {
  color: var(--color-muted);
}

.about-meta strong {
  color: var(--color-text);
  font-weight: 600;
}

.about-content {
  padding-top: 4px;
  line-height: 1.7;
  color: var(--color-text);
}

.about-content :deep(h1) {
  display: none;
}

.about-content :deep(h2) {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 650;
}

.about-content :deep(h3) {
  margin: 10px 0 4px;
  font-size: 12px;
  font-weight: 650;
}

.about-content :deep(p) {
  margin: 6px 0;
}

.about-content :deep(ul) {
  padding-left: 18px;
  margin: 6px 0 0;
}

.about-content :deep(li) {
  margin: 3px 0;
}

.about-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.about-content :deep(a:hover) {
  text-decoration: underline;
}

.about-content :deep(strong) {
  color: var(--color-text);
}

.about-content :deep(code) {
  background: var(--color-surface);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9em;
}
</style>
