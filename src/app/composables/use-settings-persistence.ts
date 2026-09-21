import { onUnmounted } from 'vue';
import { startSettingsMirror, startSettingsPersistence } from '@/orchestrators/settings-persistence.orchestrator';

export function useSettingsPersistence() {
  const dispose = startSettingsPersistence();
  onUnmounted(dispose);
}

export function useSettingsMirror() {
  const dispose = startSettingsMirror();
  onUnmounted(dispose);
}
