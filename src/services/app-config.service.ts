import {
  appendAppLog,
  clearAppLogFile,
  clearConfigFiles,
  getAppLogStatus,
  loadAppSettings,
  openAppLogFile,
  openConfigDir,
  saveAppSettings,
  type AppLogEntry,
  type AppLogStatus,
  type AppSettings,
} from '@/shared/api/app-config-api';

export type LogLevel = 'info' | 'warning' | 'error';

export function recordLog(entry: { level: LogLevel; message: string; path?: string; line?: number }): Promise<void> {
  const payload: AppLogEntry = {
    level: entry.level,
    message: entry.message,
    path: entry.path ?? null,
    line: entry.line ?? null,
  };
  return appendAppLog(payload);
}

export function recordLogSilently(entry: { level: LogLevel; message: string; path?: string; line?: number }): void {
  void recordLog(entry).catch(() => undefined);
}

export function loadLogStatus(): Promise<AppLogStatus> {
  return getAppLogStatus();
}

export function openConfigFolder(): Promise<void> {
  return openConfigDir();
}

export function openLogFile(): Promise<void> {
  return openAppLogFile();
}

export function clearConfig(): Promise<void> {
  return clearConfigFiles();
}

export function clearLog(): Promise<AppLogStatus> {
  return clearAppLogFile();
}

export function loadSettings(): Promise<AppSettings> {
  return loadAppSettings();
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return saveAppSettings(settings);
}
