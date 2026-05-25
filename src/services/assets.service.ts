import { scanCoreFields, scanCoreGraphics } from '@/shared/api/assets-api';
import type { DiscoveredField } from '@/shared/types';

export function queryCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return scanCoreFields(starsectorRoot);
}

export function queryCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return scanCoreGraphics(starsectorRoot);
}
