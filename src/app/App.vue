<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <AppContent />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppContent from '@/app/AppContent.vue';
import { useSettingsStore } from '@/stores/settings.store';
import { buildThemeOverrides } from '@/app/theme-overrides';
import { useSettingsPersistence } from '@/app/composables/use-settings-persistence';

const settings = useSettingsStore();
useSettingsPersistence();

const themeOverrides = computed(() => buildThemeOverrides(settings));
</script>
