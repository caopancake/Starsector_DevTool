import { ensureResourceMedia, resourceMediaDataUrl } from '@/services/resource-media.service';
import type { ResourceRef } from '@/shared/types';

export function useSchemaSelectMedia() {
  return {
    schemaSelectSprite: resourceMediaDataUrl,
    ensureSchemaSelectSprites: (sessionId: string, resources: ResourceRef[]): Promise<void> =>
      ensureResourceMedia(sessionId, resources, 'schema-select').then(() => undefined),
  };
}
