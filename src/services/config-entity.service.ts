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
 * 配置实体读 service：配置实体查询的唯一包装（app 层禁止直调 querySession*），
 * 记录整形委托 domain/config/config-records；写路径归 write.service 与
 * config-save 编排，不在本服务。
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
