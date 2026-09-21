import {
  appendAppLog,
  clearAppLogFile,
  clearConfigFiles,
  getAppLogStatus,
  openAppLogFile,
  openConfigDir,
} from '@/shared/api/app-feedback-log-api';
import type { AppLogEntry, AppLogStatus } from '@/shared/types/app-log.types';
import { setPerformanceLogSink } from '@/shared/runtime/performance';

function recordLog(entry: AppLogEntry): Promise<void> {
  return appendAppLog(entry);
}

export function recordLogBestEffort(entry: AppLogEntry): void {
  void recordLog(entry).catch(ignoreAppLogWriteFailure);
}

// 性能遥测经由此服务的落盘能力写出；注入点在 shared/runtime，避免反向依赖。
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
