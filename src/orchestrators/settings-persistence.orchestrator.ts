import { watch } from 'vue';
import { saveSettings } from '@/services/app-config.service';
import { useSettingsStore } from '@/stores/settings.store';
import { emitWindowEvent, listenWindowEvent } from '@/windows/tauri.events';
import { WINDOW_EVENTS, type AppSettingsChangedEvent } from '@/windows/window.events';

let started = false;
let mirrorStarted = false;

export function startSettingsPersistence(): void {
  if (started) return;
  started = true;
  const settings = useSettingsStore();
  watch(
    () => settings.settingsSnapshot(),
    (snapshot) => {
      void saveSettings(snapshot).catch(() => undefined);
      void emitWindowEvent<AppSettingsChangedEvent>(WINDOW_EVENTS.appSettingsChanged, snapshot).catch(() => undefined);
    },
    { deep: true },
  );
}

export function startSettingsMirror(): void {
  if (mirrorStarted) return;
  mirrorStarted = true;
  const settings = useSettingsStore();
  void listenWindowEvent<AppSettingsChangedEvent>(WINDOW_EVENTS.appSettingsChanged, (snapshot) => {
    settings.replaceSettings(snapshot);
  });
}
