import { invoke } from '@tauri-apps/api/core';

export interface AppLogEntry {
  level: string;
  message: string;
  path?: string | null;
  line?: number | null;
}

export interface AppLogStatus {
  path: string;
  sizeBytes: number;
}

export interface AppSettings {
  theme: string;
  accent: string;
  customAccent: string;
  historyLimit: number;
  editMode: string;
  starsectorRoot: string;
}

export function appendAppLog(entry: AppLogEntry): Promise<void> {
  return invoke('append_app_log', { entry });
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

export function loadAppSettings(): Promise<AppSettings> {
  return invoke('load_app_settings');
}

export function saveAppSettings(settings: AppSettings): Promise<void> {
  return invoke('save_app_settings', { settings });
}
