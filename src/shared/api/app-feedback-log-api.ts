import { invoke } from '@tauri-apps/api/core';
import type { AppLogEntry, AppLogStatus } from '@/shared/types/app-log.types';

export function appendAppLog(entry: AppLogEntry): Promise<void> {
  return invoke('append_app_log', { payload: { entry } });
}

export function getAppLogStatus(): Promise<AppLogStatus> {
  return invoke('get_app_log_status');
}

export function openConfigDir(): Promise<void> {
  return invoke('open_config_dir');
}

export function openAppLogFile(): Promise<void> {
  return invoke('open_app_log_file');
}

export function clearConfigFiles(): Promise<void> {
  return invoke('clear_config_files');
}

export function clearAppLogFile(): Promise<AppLogStatus> {
  return invoke('clear_app_log_file');
}
