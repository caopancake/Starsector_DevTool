import type { AppData } from '@/shared/types';

export function formatLoadWarnings(loaded: AppData): string[] {
  return loaded.warnings.map((warning) => `${warning.message}（${warning.path}）`);
}
