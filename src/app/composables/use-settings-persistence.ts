import { startSettingsMirror, startSettingsPersistence } from '@/orchestrators/settings-persistence.orchestrator';

export function useSettingsPersistence() {
  startSettingsPersistence();
}

export function useSettingsMirror() {
  startSettingsMirror();
}
