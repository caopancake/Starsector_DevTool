<template>
  <header class="titlebar" @pointerdown="startDrag" @dblclick="toggleMaximize">
    <div class="titlebar-brand">
      <span class="titlebar-mark">SD</span>
      <div class="titlebar-text">
        <strong>Starsector DevTool</strong>
        <span :title="project.data?.modRoot">{{ workspace.activeMod?.displayName || '尚未打开项目' }}</span>
      </div>
    </div>

    <div class="titlebar-controls" @pointerdown.stop @dblclick.stop>
      <button class="titlebar-button" type="button" :title="settings.isDark ? '切换到浅色' : '切换到暗色'" @click="settings.toggleTheme">
        <svg v-if="settings.isDark" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.75V3m0 18v-1.75M5.81 5.81 4.58 4.58m14.84 14.84-1.23-1.23M4.75 12H3m18 0h-1.75M5.81 18.19l-1.23 1.23M19.42 4.58l-1.23 1.23M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.25 14.3A7.78 7.78 0 0 1 9.7 3.75 8.5 8.5 0 1 0 20.25 14.3Z" />
        </svg>
      </button>
      <button class="titlebar-button" type="button" title="最小化" @click="minimizeWindow">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <button class="titlebar-button" type="button" :title="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
        <svg v-if="isMaximized" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h9v9H8zM6 15H5V5h10v1" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z" /></svg>
      </button>
      <button class="titlebar-button close" type="button" title="关闭" @click="closeWindow">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useProjectStore } from '../features/project/project.store';
import { useWorkspaceStore } from '../features/workspace/workspace.store';
import { useSettingsStore } from './settings.store';

const appWindow = getCurrentWindow();
const project = useProjectStore();
const workspace = useWorkspaceStore();
const settings = useSettingsStore();
const isMaximized = ref(false);

async function refreshMaximized() {
  isMaximized.value = await appWindow.isMaximized();
}

async function startDrag(event: { button: number; detail: number }) {
  if (event.button !== 0 || event.detail > 1) return;
  await appWindow.startDragging();
}

async function minimizeWindow() {
  await appWindow.minimize();
}

async function toggleMaximize() {
  await appWindow.toggleMaximize();
  await refreshMaximized();
}

async function closeWindow() {
  await appWindow.close();
}

onMounted(refreshMaximized);
</script>
