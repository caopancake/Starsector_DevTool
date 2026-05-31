import { computed, onUnmounted, ref, watch } from 'vue';
import { getConfigMissionEditorData, listConfigMissionRecords } from '@/services/config-entity.service';
import { useProjectStore } from '@/stores/project.store';
import type { ConfigMissionEditorData, ResourceRef, RowData } from '@/shared/types';
import {
  createIndexedConfigEntityAction,
  deleteIndexedConfigEntityAction,
  saveIndexedConfigEntityAction,
} from '@/orchestrators/config-save.orchestrator';
import {
  buildMissionIndexRow,
  configMissionSaveDraft,
  isConfigEntityId,
  missionItemsFromRows,
  type ConfigMissionSaveDraft,
} from '@/domain/config/config-entities';
import { deepClone } from '@/shared/lib/starsector';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { FileSchema } from '@/domain/schema/schema.types';
import {
  queryCacheInvalidationIncludes,
  queryCacheInvalidationIncludesResourceIdentity,
  subscribeQueryCacheInvalidation,
} from '@/services/query-cache.service';

export function useConfigMissionViewModel() {
  const selectedMission = ref<string | null>(null);
  const refreshToken = ref(0);
  const missionEditorReloadToken = ref(0);
  const missionIconRefreshToken = ref(0);
  const missionRows = ref<RowData[]>([]);
  const missionIcons = ref<Record<string, string>>({});
  const missionIconResourceRefs = ref<ResourceRef[]>([]);
  const project = useProjectStore();
  const feedback = useAppFeedback();

  const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
  const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
  const missionItems = computed(() => missionItemsFromRows(missionRows.value));
  let missionsRequestId = 0;

  function handleSaved(missionId: string | null) {
    selectedMission.value = missionId;
    refreshToken.value += 1;
    missionEditorReloadToken.value += 1;
    missionIconRefreshToken.value += 1;
  }

  async function queryMissions() {
    const requestId = ++missionsRequestId;
    const manifest = project.activeManifest;
    const activeSessionId = sessionId.value;
    if (!activeSessionId || !manifest) {
      missionRows.value = [];
      missionIcons.value = {};
      missionIconResourceRefs.value = [];
      selectedMission.value = null;
      return;
    }
    const records = await listConfigMissionRecords(activeSessionId);
    if (requestId !== missionsRequestId || activeSessionId !== sessionId.value) return;
    missionRows.value = records.map((record) => record.list);
    missionIcons.value = Object.fromEntries(records.map((record) => [record.id, record.iconSrc]));
    missionIconResourceRefs.value = records.flatMap((record) => (record.iconRef ? [record.iconRef] : []));
    const missions = missionItems.value.map((mission) => mission.id);
    if (!selectedMission.value && missions[0]) selectedMission.value = missions[0];
    if (selectedMission.value && !missions.includes(selectedMission.value)) selectedMission.value = missions[0] ?? null;
    project.updateEntitySummary(manifest.modRoot, 'missions', missionItems.value.length);
  }

  async function queryMissionEditorData(targetSessionId: string, id: string): Promise<ConfigMissionEditorData | null> {
    if (!id) return null;
    return getConfigMissionEditorData(targetSessionId, id);
  }

  async function createMission(createSessionId: string, createModRoot: string, id: string): Promise<boolean> {
    if (!isConfigEntityId(id)) {
      feedback.error('战役 ID 不能包含路径分隔符或 ..');
      return false;
    }
    await createIndexedConfigEntityAction({
      sessionId: createSessionId,
      modRoot: createModRoot,
      kind: 'mission',
      previousId: null,
      nextId: id,
      indexRow: buildMissionIndexRow([], ['mission'], id),
      entityData: { descriptor: { title: id }, text: '' },
      deletePreviousTarget: false,
    });
    feedback.success(`战役 "${id}" 已创建`);
    if (modRoot.value !== createModRoot || sessionId.value !== createSessionId) return true;
    selectedMission.value = id;
    await queryMissions();
    return true;
  }

  async function saveMission(
    saveSessionId: string,
    saveModRoot: string,
    previousId: string,
    localMission: RowData,
    schema: FileSchema,
  ): Promise<string> {
    const activeModRoot = modRoot.value;
    if (!activeModRoot || activeModRoot !== saveModRoot || sessionId.value !== saveSessionId) return previousId;
    const draft = configMissionSaveDraft(localMission, schema);
    if (!draft.nextId) {
      feedback.warning('mission 不能为空');
      return previousId;
    }
    if (!isConfigEntityId(draft.nextId)) {
      feedback.error('战役 ID 不能包含路径分隔符或 ..');
      return previousId;
    }
    await saveMissionDraft(saveSessionId, saveModRoot, previousId, draft);
    return draft.nextId;
  }

  async function saveMissionDraft(activeSessionId: string, activeModRoot: string, previousId: string, draft: ConfigMissionSaveDraft) {
    const idChanged = draft.nextId !== previousId;
    await saveIndexedConfigEntityAction({
      sessionId: activeSessionId,
      modRoot: activeModRoot,
      kind: 'mission',
      previousId: idChanged ? previousId : null,
      nextId: draft.nextId,
      indexRow: buildMissionIndexRow([draft.list], Object.keys(draft.list).length ? Object.keys(draft.list) : ['mission'], draft.nextId),
      entityData: { descriptor: deepClone(draft.descriptor), text: draft.text },
      deletePreviousTarget: idChanged,
    });
    feedback.success(`战役 "${draft.nextId}" 已保存`);
    if (modRoot.value !== activeModRoot || sessionId.value !== activeSessionId) return;
    selectedMission.value = draft.nextId;
    await queryMissions();
  }

  async function deleteMission(deleteSessionId: string, deleteModRoot: string, id: string, deleteDirectory: boolean): Promise<boolean> {
    await deleteIndexedConfigEntityAction(deleteSessionId, deleteModRoot, 'mission', id, deleteDirectory);
    feedback.success(`战役 "${id}" 已删除`);
    if (modRoot.value !== deleteModRoot || sessionId.value !== deleteSessionId) return true;
    await queryMissions();
    if (selectedMission.value === id) {
      selectedMission.value = missionItems.value[0]?.id ?? null;
    }
    return true;
  }

  async function refreshMissionList() {
    await queryMissions();
    if (!selectedMission.value && missionItems.value[0]) selectedMission.value = missionItems.value[0].id;
    if (selectedMission.value && !missionItems.value.some((mission) => mission.id === selectedMission.value)) {
      selectedMission.value = missionItems.value[0]?.id ?? null;
    }
  }

  function missionExists(id: string): boolean {
    return missionItems.value.some((mission) => mission.id === id);
  }

  function isValidMissionId(id: string): boolean {
    return isConfigEntityId(id);
  }

  watch(() => project.activeSessionId, queryMissions, { immediate: true });
  const unsubscribeQueryCacheInvalidation = subscribeQueryCacheInvalidation((event) => {
    if (event.sessionId !== sessionId.value) return;
    const missionsChanged = queryCacheInvalidationIncludes(event, 'entity-list', (parameters) => parameters.kind === 'mission');
    const missionResourcesChanged = queryCacheInvalidationIncludesResourceIdentity(event, missionIconResourceRefs.value);
    if (missionsChanged) void refreshMissionsAfterDataInvalidation();
    else if (missionResourcesChanged) void refreshMissionsAfterResourceInvalidation();
  });
  onUnmounted(unsubscribeQueryCacheInvalidation);

  async function refreshMissionsAfterDataInvalidation() {
    await queryMissions();
    refreshToken.value += 1;
    missionEditorReloadToken.value += 1;
    missionIconRefreshToken.value += 1;
  }

  async function refreshMissionsAfterResourceInvalidation() {
    await queryMissions();
    refreshToken.value += 1;
    missionIconRefreshToken.value += 1;
  }

  return {
    selectedMission,
    refreshToken,
    missionEditorReloadToken,
    missionIconRefreshToken,
    missionRows,
    missionItems,
    missionIcons,
    modRoot,
    sessionId,
    handleSaved,
    createMission,
    deleteMission,
    queryMissions,
    refreshMissionList,
    queryMissionEditorData,
    missionExists,
    isValidMissionId,
    saveMission,
  };
}
