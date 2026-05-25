import {
  appendAppLog,
  clearAppLogFile,
  clearConfigFiles,
  getAppLogStatus,
  loadAppSettings,
  openAppLogFile,
  openConfigDir,
  saveAppSettings,
} from '@/shared/api/app-config-api';
import type { AppLogEntry, AppLogStatus, AppSettings } from '@/shared/types';

export function recordLog(entry: AppLogEntry): Promise<void> {
  return appendAppLog(entry);
}

export function recordLogBestEffort(entry: AppLogEntry): void {
  void recordLog(entry).catch(ignoreAppLogWriteFailure);
}

function ignoreAppLogWriteFailure(): void {
  return;
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
