import { ensureSchemaSelectSprites, schemaSelectSprite } from '@/services/schema-select-media.service';

export function useSchemaSelectMedia() {
  return {
    schemaSelectSprite,
    ensureSchemaSelectSprites,
  };
}
