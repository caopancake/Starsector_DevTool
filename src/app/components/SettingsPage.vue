<template>
  <div class="settings-page">
    <header class="settings-header"><h1>设置</h1></header>
    <section class="settings-section">
      <h3>外观</h3>
      <div class="settings-row">
        <span>主题</span>
        <n-switch :value="settings.isDark" @update:value="settings.toggleTheme">
          <template #checked>暗色</template>
          <template #unchecked>浅色</template>
        </n-switch>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../settings.store';

const settings = useSettingsStore();
</script>
