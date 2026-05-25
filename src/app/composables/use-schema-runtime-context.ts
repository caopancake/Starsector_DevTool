import { computed } from 'vue';
import { queryTableSourceOptions } from '@/services/csv-table.service';
import type { ProjectManifest, SchemaRuntimeContext } from '@/shared/types';

export function useSchemaRuntimeContext(manifest: () => ProjectManifest | null | undefined) {
  return computed<SchemaRuntimeContext | null>(() => {
    const active = manifest();
    return active ? createSchemaRuntimeContext(active.modRoot, active.sessionId) : null;
  });
}

export function createSchemaRuntimeContext(modRoot: string, sessionId: string): SchemaRuntimeContext {
  return {
    modRoot,
    sessionId,
    querySourceOptions: (source, currentValues, search, limit) =>
      queryTableSourceOptions(sessionId, source, currentValues, search ?? null, limit ?? null),
  };
}
