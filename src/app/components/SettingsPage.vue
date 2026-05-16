<template>
  <div class="settings-page">
    <header class="settings-header"><h1>设置</h1></header>
    <section class="settings-section">
      <h3>游戏目录</h3>
      <div class="settings-row">
        <span>Starsector 安装路径</span>
        <div style="flex: 1; display: flex; gap: 8px; align-items: center">
          <n-input :value="settings.starsectorRoot" size="small" placeholder="自动推断或手动指定" readonly style="flex: 1" />
          <n-button size="small" @click="pickStarsectorRoot">选择目录</n-button>
          <n-button v-if="settings.starsectorRoot" size="small" quaternary @click="settings.setStarsectorRoot('')">清除</n-button>
        </div>
      </div>
      <div v-if="settings.starsectorRoot" class="settings-hint">已设置: {{ settings.starsectorRoot }}</div>
      <div v-else class="settings-hint">未设置时，工具将从导入的 Mod 路径自动推断（mod_root 的上两级目录）。</div>
    </section>
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
    <section class="settings-section">
      <h3>历史记录</h3>
      <div class="settings-row">
        <span>全局撤销上限</span>
        <n-input-number
          :value="settings.historyLimit"
          :min="1"
          :max="1000"
          :step="16"
          style="width: 120px"
          @update:value="settings.setHistoryLimit($event ?? 128)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../settings.store';

const settings = useSettingsStore();

async function pickStarsectorRoot() {
  const selected = await open({ directory: true, title: '选择 Starsector 安装目录' });
  if (selected && typeof selected === 'string') {
    settings.setStarsectorRoot(selected);
  }
}
</script>

<style scoped>
.settings-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: 4px 0 0;
}
</style>
