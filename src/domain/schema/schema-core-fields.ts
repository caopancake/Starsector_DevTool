import type { DiscoveredField, FieldSchema, FileSchema } from '@/domain/schema/schema.types';
import { getExtraFieldSource, getSchemaSections } from '@/domain/schema/schema-sections';

export function mergeSchemaWithCoreFields(schema: FileSchema, discoveredFields: DiscoveredField[]): FileSchema {
  if (!discoveredFields || discoveredFields.length === 0) return schema;
  const coreSourceId = getExtraFieldSource(schema) ?? schema.sources?.[0]?.id ?? null;

  const definedKeys = new Set<string>();
  const sections = getSchemaSections(schema);
  for (const section of sections) {
    for (const field of section.fields) {
      definedKeys.add(coreFieldKey(field.key, coreSourceId));
      if (field.nested) {
        for (const sub of field.nested) {
          definedKeys.add(coreFieldKey(`${field.key}.${sub.key}`, coreSourceId));
        }
      }
    }
  }

  const newFields: FieldSchema[] = discoveredFields
    .filter((df) => !definedKeys.has(df.key))
    .map((df) => ({
      key: coreSourceId ? `${coreSourceId}.${df.key}` : df.key,
      type: df.type as FieldSchema['type'],
      label: df.key,
      description: '来自 starsector-core（自动发现）',
    }));

  if (newFields.length === 0) return schema;

  return {
    ...schema,
    sections: [
      ...sections,
      {
        id: '__core_discovered',
        label: `来自原版 (${newFields.length})`,
        collapsed: true,
        fields: newFields,
      },
    ],
  };
}

function coreFieldKey(key: string, sourceId: string | null): string {
  return sourceId && key.startsWith(`${sourceId}.`) ? key.slice(sourceId.length + 1) : key;
}
