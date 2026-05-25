import { computed, ref } from 'vue';
import { getConfigMissionEditorData, listConfigMissionRecords } from '@/services/config-entity.service';
import { useProjectStore } from '@/stores/project.store';
import type { ConfigMissionEditorData, RowData } from '@/shared/types';
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

export function useConfigMissionViewModel() {
  const selectedMission = ref<string | null>(null);
  const refreshToken = ref(0);
  const missionRows = ref<RowData[]>([]);
  const missionIcons = ref<Record<string, string>>({});
  const project = useProjectStore();
  const feedback = useAppFeedback();

  const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
  const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
  const missionItems = computed(() => missionItemsFromRows(missionRows.value));

  function handleSaved(missionId: string | null) {
    selectedMission.value = missionId;
    refreshToken.value += 1;
  }

  async function queryMissions() {
    const manifest = project.activeManifest;
    if (!sessionId.value || !manifest) {
      missionRows.value = [];
      missionIcons.value = {};
      selectedMission.value = null;
      return;
    }
    const records = await listConfigMissionRecords(sessionId.value);
    missionRows.value = records.map((record) => record.list);
    missionIcons.value = Object.fromEntries(records.map((record) => [record.id, record.iconSrc]));
    const missions = missionItems.value.map((mission) => mission.id);
    if (!selectedMission.value && missions[0]) selectedMission.value = missions[0];
    if (selectedMission.value && !missions.includes(selectedMission.value)) selectedMission.value = missions[0] ?? null;
    project.updateEntitySummary(manifest.modRoot, 'missions', missionItems.value.length);
  }

  async function queryMissionEditorData(id: string): Promise<ConfigMissionEditorData | null> {
    if (!sessionId.value || !id) return null;
    return getConfigMissionEditorData(sessionId.value, id);
  }

  async function createMission(id: string): Promise<boolean> {
    if (!modRoot.value) return false;
    if (!isConfigEntityId(id)) {
      feedback.error('战役 ID 不能包含路径分隔符或 ..');
      return false;
    }
    await createIndexedConfigEntityAction({
      modRoot: modRoot.value,
      kind: 'mission',
      previousId: null,
      nextId: id,
      indexRow: buildMissionIndexRow([], ['mission'], id),
      entityData: { descriptor: { title: id }, text: '' },
      deletePreviousTarget: false,
    });
    selectedMission.value = id;
    feedback.success(`战役 "${id}" 已创建`);
    await queryMissions();
    return true;
  }

  async function saveMission(previousId: string, localMission: RowData, schema: FileSchema): Promise<string> {
    if (!modRoot.value) return previousId;
    const draft = configMissionSaveDraft(localMission, schema);
    if (!draft.nextId) {
      feedback.warning('mission 不能为空');
      return previousId;
    }
    if (!isConfigEntityId(draft.nextId)) {
      feedback.error('战役 ID 不能包含路径分隔符或 ..');
      return previousId;
    }
    await saveMissionDraft(modRoot.value, previousId, draft);
    return draft.nextId;
  }

  async function saveMissionDraft(activeModRoot: string, previousId: string, draft: ConfigMissionSaveDraft) {
    const idChanged = draft.nextId !== previousId;
    await saveIndexedConfigEntityAction({
      modRoot: activeModRoot,
      kind: 'mission',
      previousId: idChanged ? previousId : null,
      nextId: draft.nextId,
      indexRow: buildMissionIndexRow([draft.list], Object.keys(draft.list).length ? Object.keys(draft.list) : ['mission'], draft.nextId),
      entityData: { descriptor: deepClone(draft.descriptor), text: draft.text },
      deletePreviousTarget: idChanged,
    });
    selectedMission.value = draft.nextId;
    feedback.success(`战役 "${draft.nextId}" 已保存`);
    await queryMissions();
  }

  async function deleteMission(id: string, deleteDirectory: boolean): Promise<boolean> {
    if (!modRoot.value) return false;
    await deleteIndexedConfigEntityAction(modRoot.value, 'mission', id, deleteDirectory);
    feedback.success(`战役 "${id}" 已删除`);
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

  return {
    selectedMission,
    refreshToken,
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
