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
import { useSettingsStore } from '@/stores/settings.store';
import { buildThemeOverrides } from '@/app/theme-overrides';
import { useSettingsMirror } from '@/app/composables/use-settings-persistence';

const settings = useSettingsStore();
useSettingsMirror();
const themeOverrides = computed(() => buildThemeOverrides(settings));
</script>
