import type { FileSchema } from '@/domain/schema/schema.types';
import { validateSchemaCsvSources } from '@/domain/schema/schema-sources';

import modInfoSchemaRaw from '../../../schemas/mod-info.schema.json';
import factionSchemaRaw from '../../../schemas/faction.schema.json';
import missionSchemaRaw from '../../../schemas/mission.schema.json';
import skinSchemaRaw from '../../../schemas/skin.schema.json';
import variantSchemaRaw from '../../../schemas/variant.schema.json';

const SCHEMAS: Record<string, FileSchema> = {
  'mod-info': schemaAsset(modInfoSchemaRaw),
  faction: schemaAsset(factionSchemaRaw),
  mission: schemaAsset(missionSchemaRaw),
  skin: schemaAsset(skinSchemaRaw),
  variant: schemaAsset(variantSchemaRaw),
};

function schemaAsset(schema: unknown): FileSchema {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Invalid schema asset');
  }
  const validatedAsset = schema as FileSchema;
  validateSchemaCsvSources(validatedAsset);
  return validatedAsset;
}

export function getSchema(id: string): FileSchema | null {
  return SCHEMAS[id] ?? null;
}
