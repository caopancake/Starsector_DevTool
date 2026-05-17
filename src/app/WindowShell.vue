<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <slot />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from './settings-store';
import { buildThemeOverrides } from './theme-overrides';

const settings = useSettingsStore();
const themeOverrides = computed(() => buildThemeOverrides(settings));
</script>
