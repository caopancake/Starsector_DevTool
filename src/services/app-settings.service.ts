import { loadAppSettings, saveAppSettings } from '@/shared/api/app-settings-api';
import type { AppSettings } from '@/shared/types/settings.types';

export function loadSettings(): Promise<AppSettings> {
  return loadAppSettings();
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return saveAppSettings(settings);
}
