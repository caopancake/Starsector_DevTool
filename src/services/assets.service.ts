import { scanCoreFields as scanCoreFieldsApi, scanCoreGraphics as scanCoreGraphicsApi } from '@/shared/api/query-api';
import type { DiscoveredField } from '@/shared/types';

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return scanCoreFieldsApi(starsectorRoot);
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return scanCoreGraphicsApi(starsectorRoot);
}
