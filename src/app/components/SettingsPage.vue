<template>
  <div class="settings-page">
    <header class="settings-header"><h1>设置</h1></header>
    <section class="settings-section">
      <h3>游戏目录</h3>
      <div class="settings-row">
        <span>Starsector 安装路径</span>
        <div class="settings-control-row">
          <n-input :value="settings.starsectorRoot" size="small" placeholder="自动推断或手动指定" readonly />
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
        <n-switch class="tool-switch settings-theme-switch" :value="settings.isDark" @update:value="settings.toggleTheme">
          <template #checked>暗色</template>
          <template #unchecked>浅色</template>
        </n-switch>
      </div>
      <div class="settings-row settings-row-top">
        <span>主题色</span>
        <div class="accent-settings">
          <div class="accent-swatch-grid">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.value"
              class="accent-swatch-button"
              :class="{ active: settings.accent === preset.value }"
              type="button"
              :title="preset.name"
              @click="settings.setAccent(preset.value)"
            >
              <span :style="{ backgroundColor: preset.hex }" />
            </button>
            <div class="accent-custom-control" :class="{ active: settings.accent === 'custom' }">
              <button class="accent-custom-label" type="button" @click="settings.setAccent('custom')">自定义</button>
              <ColorPicker
                v-model="customAccentDraft"
                class="accent-custom-input"
                channels="rgb"
                output="hex-rgb"
                :allow-text-input="true"
                @click="settings.setAccent('custom')"
                @update:model-value="applyCustomAccent"
              />
            </div>
          </div>
          <div v-if="!customAccentValid" class="settings-hint settings-hint-error">自定义主题色必须是 #RRGGBB。</div>
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h3>全局记录</h3>
      <div class="settings-row">
        <span>文件历史记录</span>
        <n-input-number
          class="settings-number-input"
          :value="settings.historyLimit"
          :min="1"
          :max="MAX_HISTORY_LIMIT"
          :step="1"
          @update:value="settings.setHistoryLimit($event ?? DEFAULT_HISTORY_LIMIT)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { ACCENT_PRESETS, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT, useSettingsStore } from '../settings-store';
import ColorPicker from '../../shared/components/ColorPicker.vue';

const settings = useSettingsStore();
const customAccentDraft = ref(settings.customAccent);
const customAccentValid = ref(true);

watch(
  () => settings.customAccent,
  (value) => {
    customAccentDraft.value = value;
    customAccentValid.value = true;
  },
);

function applyCustomAccent(value: string | number[] = customAccentDraft.value) {
  if (typeof value !== 'string') return;
  customAccentDraft.value = value;
  const applied = settings.setCustomAccent(value);
  customAccentValid.value = applied;
}

async function pickStarsectorRoot() {
  const selected = await open({ directory: true, title: '选择 Starsector 安装目录' });
  if (selected && typeof selected === 'string') {
    settings.setStarsectorRoot(selected);
  }
}
</script>
