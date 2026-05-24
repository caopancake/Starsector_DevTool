import type { ProjectManifest } from '@/shared/types';

export function formatLoadWarnings(loaded: ProjectManifest): string[] {
  return loaded.warnings.map((warning) => `${warning.message}（${warning.path}）`);
}
