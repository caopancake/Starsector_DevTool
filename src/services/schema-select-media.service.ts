import { ensureResourceMedia, resourceMediaDataUrl } from '@/services/resource-media.service';
import type { ResourceRef } from '@/shared/types';

export function schemaSelectSprite(sessionId: string | null | undefined, resource: ResourceRef | null | undefined): string | undefined {
  return resourceMediaDataUrl(sessionId, resource);
}

export function ensureSchemaSelectSprites(sessionId: string, resources: ResourceRef[]): Promise<void> {
  return ensureResourceMedia(sessionId, resources, 'schema-select').then(() => undefined);
}
