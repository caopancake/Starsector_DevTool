<template>
  <div class="settings-page">
    <header class="settings-header"><h1>About</h1></header>

    <section class="settings-section">
      <h3>{{ APP_NAME }}</h3>
      <div class="about-version">v{{ APP_VERSION }}</div>
      <p class="about-description">Starsector Mod 开发桌面工具，支持 CSV 表格编辑、舰船/武器/弹体编辑器、装配/皮肤配置和文件级历史管理。</p>
    </section>

    <section class="settings-section">
      <h3>作者</h3>
      <div class="about-author">{{ APP_AUTHOR }}</div>
    </section>

    <section v-if="APP_LINKS.length > 0" class="settings-section">
      <h3>链接</h3>
      <div v-for="link in APP_LINKS" :key="link.label" class="about-link-row">
        <span>{{ link.label }}</span>
        <a v-if="link.url" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.url }}</a>
        <span v-else class="about-link-placeholder">待配置</span>
      </div>
    </section>

    <section class="settings-section">
      <h3>更新日志</h3>
      <div v-for="entry in CHANGELOG" :key="entry.version" class="about-changelog-entry">
        <div class="about-changelog-version">
          v{{ entry.version }} <span class="about-changelog-date">{{ entry.date }}</span>
        </div>
        <ul class="about-changelog-list">
          <li v-for="(change, idx) in entry.changes" :key="idx">{{ change }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// ─── 可配置常量 ──────────────────────────────────────────────────────
const APP_NAME = 'Starsector DevTool';
const APP_VERSION = '0.1.0';
const APP_AUTHOR = 'cakecao';
const APP_LINKS: { label: string; url: string }[] = [{ label: 'GitHub', url: '' }];

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2025-05',
    changes: [
      '初始版本',
      '支持多 Mod 工作区',
      'CSV 表格编辑与草稿历史',
      '舰船编辑器（画布编辑 .ship）',
      '武器编辑器与发射预览',
      '弹体编辑器',
      '装配编辑（.variant schema 表单）',
      '舰船皮肤编辑（.skin schema 表单）',
      '阵营与任务配置编辑',
      '文件级 history、撤销与重做',
      '原版资源回退与贴图导入',
      '描述文本 CSV 支持',
    ],
  },
];
</script>

<style scoped>
.about-version {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color-1);
  margin-bottom: 0.5rem;
}

.about-description {
  color: var(--text-color-2);
  line-height: 1.6;
  margin: 0;
}

.about-author {
  color: var(--text-color-1);
  font-weight: 500;
}

.about-link-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.about-link-row a {
  color: var(--primary-color);
  text-decoration: none;
}

.about-link-row a:hover {
  text-decoration: underline;
}

.about-link-placeholder {
  color: var(--text-color-3);
  font-style: italic;
}

.about-changelog-entry {
  margin-bottom: 1rem;
}

.about-changelog-version {
  font-weight: 600;
  color: var(--text-color-1);
  margin-bottom: 0.25rem;
}

.about-changelog-date {
  font-weight: 400;
  color: var(--text-color-3);
  margin-left: 0.5rem;
}

.about-changelog-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--text-color-2);
  line-height: 1.7;
}
</style>
