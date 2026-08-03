import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@/shared/types/settings.types';

export function loadAppSettings(): Promise<AppSettings> {
  return invoke('load_app_settings');
}

export function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke('save_app_settings', { payload: { settings } });
}
