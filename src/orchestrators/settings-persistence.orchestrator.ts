import { watch } from 'vue';
import { saveSettings } from '@/services/app-config.service';
import { useSettingsStore } from '@/stores/settings.store';

let started = false;

export function startSettingsPersistence(): void {
  if (started) return;
  started = true;
  const settings = useSettingsStore();
  watch(
    () => settings.settingsSnapshot(),
    (snapshot) => {
      void saveSettings(snapshot).catch(() => undefined);
    },
    { deep: true },
  );
}
