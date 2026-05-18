import { loadImageDataUrl as loadImageDataUrlApi } from '@/shared/api/assets-api';
import { scanCoreFields as scanCoreFieldsApi, scanCoreGraphics as scanCoreGraphicsApi } from '@/shared/api/assets-api';
import type { DiscoveredField } from '@/domain/schema/schema.types';

export function loadImageDataUrl(modRoot: string, relPath: string, starsectorRoot?: string): Promise<string | null> {
  return loadImageDataUrlApi(modRoot, relPath, starsectorRoot);
}

export function scanCoreFields(starsectorRoot: string): Promise<Record<string, DiscoveredField[]>> {
  return scanCoreFieldsApi(starsectorRoot);
}

export function scanCoreGraphics(starsectorRoot: string): Promise<string[]> {
  return scanCoreGraphicsApi(starsectorRoot);
}
