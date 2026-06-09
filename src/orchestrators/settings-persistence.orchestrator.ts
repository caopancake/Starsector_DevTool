import { watch } from 'vue';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { saveSettings } from '@/services/app-settings.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { emitWindowEvent, listenWindowEvent } from '@/windows/tauri.events';
import { WINDOW_EVENTS, type AppSettingsChangedEvent } from '@/windows/window.events';
import { formatError } from '@/shared/lib/errors';
import type { AppSettings } from '@/shared/types';
import { recordWindowEventHandlerError } from '@/orchestrators/window-event-errors.orchestrator';

let started = false;
let mirrorStarted = false;

export function startSettingsPersistence(): void {
  if (started) return;
  started = true;
  const settings = useSettingsStore();
  syncHistoryLimit(settings.historyLimit);
  watch(
    () => settings.settingsSnapshot(),
    (snapshot) => {
      syncHistoryLimit(snapshot.historyLimit);
      void persistSettingsSnapshot(snapshot);
    },
    { deep: true },
  );
}

export function startSettingsMirror(): void {
  if (mirrorStarted) return;
  mirrorStarted = true;
  const settings = useSettingsStore();
  void listenWindowEvent<AppSettingsChangedEvent>(
    WINDOW_EVENTS.appSettingsChanged,
    (snapshot) => {
      settings.replaceSettings(snapshot);
      syncHistoryLimit(snapshot.historyLimit);
    },
    recordWindowEventHandlerError,
  ).catch((error: unknown) => {
    recordLogBestEffort({ level: 'error', message: `监听设置广播失败：${formatError(error)}`, path: null, line: null });
  });
}

function syncHistoryLimit(limit: number): void {
  useFileHistoryStore().setHistoryLimit(limit);
  useTablesEditHistoryStore().setHistoryLimit(limit);
}

async function persistSettingsSnapshot(snapshot: AppSettings): Promise<void> {
  const [saveResult, broadcastResult] = await Promise.allSettled([
    saveSettings(snapshot),
    emitWindowEvent<AppSettingsChangedEvent>(WINDOW_EVENTS.appSettingsChanged, snapshot),
  ]);
  if (saveResult.status === 'rejected') {
    recordLogBestEffort({ level: 'error', message: `保存设置失败：${formatError(saveResult.reason)}`, path: null, line: null });
  }
  if (broadcastResult.status === 'rejected') {
    recordLogBestEffort({ level: 'error', message: `广播设置失败：${formatError(broadcastResult.reason)}`, path: null, line: null });
  }
}
