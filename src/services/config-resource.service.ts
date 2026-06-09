import { querySessionHullReferences } from '@/services/query.service';
import { queryResourceDataUrls } from '@/services/resource-cache.service';
import { isResourceRef } from '@/shared/lib/resource-ref';
import type { EntityData, ProjectSessionId, ResourceRef } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-options';

export interface HydratedResourceMap {
  resourceRefs: ResourceRef[];
  sprites: Record<string, string>;
}

export async function hydrateFactionCrests(
  sessionId: ProjectSessionId,
  entities: EntityData[],
): Promise<{ crestRefs: Record<string, ResourceRef>; crestSrcs: Record<string, string> }> {
  const crestEntities = entities.flatMap((entity) => {
    const resource = entity.resourceRefs.crest;
    return resource ? [{ id: entity.id, resource }] : [];
  });
  const crestUrls = await queryResourceDataUrls(
    sessionId,
    crestEntities.map((entity) => entity.resource),
  );
  return {
    crestRefs: Object.fromEntries(crestEntities.map((entity) => [entity.id, entity.resource])),
    crestSrcs: Object.fromEntries(crestEntities.map((entity, index) => [entity.id, crestUrls[index] ?? ''])),
  };
}

export async function hydrateFactionPreviewImages(
  sessionId: ProjectSessionId,
  entity: EntityData | null,
): Promise<{ logoSrc: string; crestSrc: string }> {
  const entries = [
    { key: 'logoSrc' as const, resource: entity?.resourceRefs.logo ?? null },
    { key: 'crestSrc' as const, resource: entity?.resourceRefs.crest ?? null },
  ].filter((entry): entry is { key: 'logoSrc' | 'crestSrc'; resource: ResourceRef } => isResourceRef(entry.resource));
  if (!entity || entries.length === 0) return { logoSrc: '', crestSrc: '' };
  const dataUrls = await queryResourceDataUrls(
    sessionId,
    entries.map((entry) => entry.resource),
  );
  const result = { logoSrc: '', crestSrc: '' };
  entries.forEach((entry, index) => {
    result[entry.key] = dataUrls[index] ?? '';
  });
  return result;
}

export async function hydrateMissionIcons(
  sessionId: ProjectSessionId,
  entities: EntityData[],
): Promise<{ iconRefs: Record<string, ResourceRef>; iconSrcs: Record<string, string> }> {
  const iconEntities = entities.flatMap((entity) => {
    const resource = entity.resourceRefs.icon;
    return resource ? [{ id: entity.id, resource }] : [];
  });
  const iconUrls = await queryResourceDataUrls(
    sessionId,
    iconEntities.map((entity) => entity.resource),
  );
  return {
    iconRefs: Object.fromEntries(iconEntities.map((entity) => [entity.id, entity.resource])),
    iconSrcs: Object.fromEntries(iconEntities.map((entity, index) => [entity.id, iconUrls[index] ?? ''])),
  };
}

export async function hydrateMissionIcon(sessionId: ProjectSessionId, entity: EntityData): Promise<string> {
  const resource = entity.resourceRefs.icon ?? null;
  return resource ? ((await queryResourceDataUrls(sessionId, [resource]))[0] ?? '') : '';
}

export async function queryHullReferenceOptions(sessionId: ProjectSessionId, referenceIds: string[]): Promise<SelectOption[]> {
  const result = await querySessionHullReferences(sessionId, referenceIds);
  const resources = result.groups.flatMap((group) => group.options.map((option) => option.resourceRef).filter(isResourceRef));
  const dataUrls = await queryResourceDataUrls(sessionId, resources);
  let resourceIndex = 0;
  return result.groups.flatMap((group) =>
    group.options.map((option) => {
      const resource = isResourceRef(option.resourceRef) ? option.resourceRef : null;
      const sprite = resource ? (dataUrls[resourceIndex++] ?? '') : '';
      return {
        label: option.label,
        value: option.value,
        sprite,
        resourceRef: resource,
      };
    }),
  );
}

export async function queryHullPreviewResources(sessionId: ProjectSessionId, hullIds: string[]): Promise<HydratedResourceMap> {
  const result = await querySessionHullReferences(sessionId, hullIds);
  return hydrateResourceMap(sessionId, result.sprites);
}

export async function querySkinPreviewResources(sessionId: ProjectSessionId, skinIds: string[]): Promise<HydratedResourceMap> {
  const result = await querySessionHullReferences(sessionId, skinIds);
  return hydrateResourceMap(sessionId, result.sprites);
}

async function hydrateResourceMap(sessionId: ProjectSessionId, refs: Record<string, ResourceRef>): Promise<HydratedResourceMap> {
  const entries = Object.entries(refs);
  const dataUrls = await queryResourceDataUrls(
    sessionId,
    entries.map(([, ref]) => ref),
  );
  return {
    resourceRefs: entries.map(([, ref]) => ref),
    sprites: Object.fromEntries(entries.map(([id], index) => [id, dataUrls[index] ?? ''])),
  };
}
