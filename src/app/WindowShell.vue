<template>
  <n-config-provider :theme="settings.naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <AppContent v-if="mode === 'main'" />
        <slot v-else />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppContent from '@/app/AppContent.vue';
import { useSettingsStore } from '@/stores/settings.store';
import { buildThemeOverrides } from '@/app/theme-overrides';
import { useThemeDomEffect } from '@/app/composables/settings/use-theme-dom-effect';
import { useSettingsPersistence, useSettingsMirror } from '@/app/composables/settings/use-settings-persistence';

const props = withDefaults(defineProps<{ mode?: 'main' | 'child' }>(), {
  mode: 'child',
});

const settings = useSettingsStore();
if (props.mode === 'main') useSettingsPersistence();
else useSettingsMirror();
useThemeDomEffect();
const themeOverrides = computed(() => buildThemeOverrides(settings.themeColors));
</script>
