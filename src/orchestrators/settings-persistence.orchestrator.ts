import { watch } from 'vue';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { saveSettings } from '@/services/app-settings.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { emitWindowEvent, listenWindowEvent, type UnlistenFn } from '@/windows/tauri.events';
import { WINDOW_EVENTS, type AppSettingsChangedEvent } from '@/windows/window.events';
import { errorCodeOf } from '@/shared/lib/errors';
import type { AppSettings } from '@/shared/types';
import { recordWindowEventHandlerError } from '@/orchestrators/window-event-errors.orchestrator';

let started = false;
let mirrorStarted = false;
let skipPersistedSnapshot = false;

const noopDispose = () => {};

export function startSettingsPersistence(): () => void {
  if (started) return noopDispose;
  started = true;
  const settings = useSettingsStore();
  syncHistoryLimit(settings.historyLimit);
  const stopWatch = watch(
    () => settings.settingsSnapshot(),
    (snapshot) => {
      if (skipPersistedSnapshot) {
        skipPersistedSnapshot = false;
        return;
      }
      syncHistoryLimit(snapshot.historyLimit);
      void persistSettingsSnapshot(snapshot);
    },
    { deep: true },
  );
  return stopWatch;
}

export async function saveLogDirectory(directory: string | null): Promise<void> {
  const settings = useSettingsStore();
  const snapshot: AppSettings = { ...settings.settingsSnapshot(), logDirectory: directory };
  const savedSettings = await saveSettings(snapshot);
  if (settings.logDirectory !== savedSettings.logDirectory) {
    skipPersistedSnapshot = true;
    settings.replaceSettings(savedSettings);
  }
  await broadcastSettingsSnapshot(savedSettings);
}

export function startSettingsMirror(): () => void {
  if (mirrorStarted) return noopDispose;
  mirrorStarted = true;
  const settings = useSettingsStore();
  const unlisteners: UnlistenFn[] = [];
  void listenWindowEvent<AppSettingsChangedEvent>(
    WINDOW_EVENTS.appSettingsChanged,
    (snapshot) => {
      settings.replaceSettings(snapshot);
      syncHistoryLimit(snapshot.historyLimit);
    },
    recordWindowEventHandlerError,
  )
    .then((unlisten) => {
      unlisteners.push(unlisten);
    })
    .catch((error: unknown) => {
      recordLogBestEffort({
        level: 'error',
        code: errorCodeOf(error),
        message: 'settings broadcast listener failed',
        path: null,
        line: null,
      });
    });
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}

function syncHistoryLimit(limit: number): void {
  useFileHistoryStore().setHistoryLimit(limit);
  useTablesEditHistoryStore().setHistoryLimit(limit);
}

async function persistSettingsSnapshot(snapshot: AppSettings): Promise<void> {
  try {
    await saveSettings(snapshot);
  } catch (error) {
    recordLogBestEffort({ level: 'error', code: errorCodeOf(error), message: 'settings save failed', path: null, line: null });
    return;
  }
  recordLogBestEffort({ level: 'debug', code: null, message: 'settings saved', path: null, line: null });
  await broadcastSettingsSnapshot(snapshot);
}

async function broadcastSettingsSnapshot(snapshot: AppSettings): Promise<void> {
  try {
    await emitWindowEvent<AppSettingsChangedEvent>(WINDOW_EVENTS.appSettingsChanged, snapshot);
  } catch (error) {
    recordLogBestEffort({ level: 'error', code: errorCodeOf(error), message: 'settings broadcast failed', path: null, line: null });
  }
}
