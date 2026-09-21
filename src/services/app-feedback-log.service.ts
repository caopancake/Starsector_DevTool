import {
  appendAppLog,
  clearAppLogFile,
  clearConfigFiles,
  getAppLogStatus,
  openAppLogFile,
  openConfigDir,
} from '@/shared/api/app-feedback-log-api';
import type { AppLogEntry, AppLogStatus } from '@/shared/types';
import { setPerformanceLogSink } from '@/shared/runtime/performance';

function recordLog(entry: AppLogEntry): Promise<void> {
  return appendAppLog(entry);
}

export function recordLogBestEffort(entry: AppLogEntry): void {
  void recordLog(entry).catch(ignoreAppLogWriteFailure);
}

// Performance telemetry persists through this service's logging capability; the injection
// point lives in shared/runtime to keep the dependency direction one-way.
setPerformanceLogSink((entry) => recordLogBestEffort(entry));

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
