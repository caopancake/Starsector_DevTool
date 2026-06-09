import {
  appendAppLog,
  clearAppLogFile,
  clearConfigFiles,
  getAppLogStatus,
  openAppLogFile,
  openConfigDir,
} from '@/shared/api/app-feedback-log-api';
import type { AppLogEntry, AppLogStatus } from '@/shared/types/app-log.types';

function recordLog(entry: AppLogEntry): Promise<void> {
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
