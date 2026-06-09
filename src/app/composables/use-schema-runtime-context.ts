import { computed } from 'vue';
import { queryTableSourceOptions } from '@/services/csv-table.service';
import { hasSourceInvalidation, subscribeQueryInvalidations } from '@/services/query-cache.service';
import { hasResourceInvalidation, subscribeResourceInvalidations } from '@/services/resource-cache.service';
import type { SchemaRuntimeContext } from '@/domain/schema/schema-runtime';
import type { ProjectManifest } from '@/shared/types';

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
    subscribeSourceOptionInvalidation: (source, resources, listener) => {
      const stopQueryInvalidation = subscribeQueryInvalidations((event) => {
        if (event.sessionId !== sessionId) return;
        if (!hasSourceInvalidation(event, source)) return;
        listener();
      });
      const stopResourceInvalidation = subscribeResourceInvalidations((event) => {
        if (event.sessionId !== sessionId) return;
        if (!hasResourceInvalidation(event, resources())) return;
        listener();
      });
      return () => {
        stopQueryInvalidation();
        stopResourceInvalidation();
      };
    },
  };
}
