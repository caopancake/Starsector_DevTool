import type { HydratedSourceOptionGroup, ProjectSessionId, ResourceRef } from '@/shared/types';

export const SCHEMA_SOURCE_OPTION_LIMIT = 500;

export interface SchemaRuntimeContext {
  modRoot: string;
  sessionId: ProjectSessionId;
  querySourceOptions?: (source: string, currentValues: string[], search?: string, limit?: number) => Promise<HydratedSourceOptionGroup[]>;
  subscribeSourceOptionInvalidation?: (source: string, resources: () => ResourceRef[], listener: () => void) => () => void;
}
