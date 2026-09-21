import { querySessionEntity, querySessionEntityList } from '@/services/query.service';
import { hydrateFactionPreviewImages, hydrateMissionIcon } from '@/services/config-resource.service';
import {
  missionEditorDataFromEntity,
  toConfigFactionRecord,
  toConfigMissionRecord,
  toConfigSkinRecord,
  toConfigVariantRecord,
  type ConfigFactionPreviewImages,
} from '@/domain/config/config-records';
import type { ConfigMissionEditorData, ProjectSessionId } from '@/shared/types';

/**
 * Read service for config entities: the only wrapper around config entity queries
 * (the app layer must not call querySession* directly). Record shaping is delegated
 * to domain/config/config-records; write paths belong to write.service and the
 * config-save orchestration, never to this service.
 */
export function listConfigFactionRecords(sessionId: ProjectSessionId) {
  return querySessionEntityList(sessionId, 'faction').then((entities) => entities.map(toConfigFactionRecord));
}

export function listConfigMissionRecords(sessionId: ProjectSessionId) {
  return querySessionEntityList(sessionId, 'mission').then((entities) => entities.map(toConfigMissionRecord));
}

export function listVariantRecords(sessionId: ProjectSessionId) {
  return querySessionEntityList(sessionId, 'variant').then((entities) => entities.map(toConfigVariantRecord));
}

export function listSkinRecords(sessionId: ProjectSessionId) {
  return querySessionEntityList(sessionId, 'skin').then((entities) => entities.map(toConfigSkinRecord));
}

export function queryFactionPreviewImages(sessionId: ProjectSessionId, id: string): Promise<ConfigFactionPreviewImages> {
  return querySessionEntity(sessionId, 'faction', id).then((entity) => hydrateFactionPreviewImages(sessionId, entity));
}

export function getConfigMissionEditorData(sessionId: ProjectSessionId, id: string): Promise<ConfigMissionEditorData | null> {
  return querySessionEntity(sessionId, 'mission', id).then(async (entity) => {
    if (!entity) return null;
    const iconSrc = await hydrateMissionIcon(sessionId, entity);
    return missionEditorDataFromEntity(entity, iconSrc);
  });
}
