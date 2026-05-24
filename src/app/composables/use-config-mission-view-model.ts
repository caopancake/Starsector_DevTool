import { computed, ref } from 'vue';
import { getMissionEntity, listMissionEntities } from '@/services/config-entity.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { useProjectStore } from '@/stores/project.store';
import type { EntityData, RowData } from '@/shared/types';
import {
  createIndexedConfigEntityWithFileHistory,
  deleteIndexedConfigEntityWithFileHistory,
  saveIndexedConfigEntityWithFileHistory,
} from '@/orchestrators/config-save.orchestrator';
import { buildMissionIndexRow } from '@/domain/config/config-entities';
import { deepClone } from '@/shared/lib/starsector';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

export function useConfigMissionViewModel() {
  const selectedMission = ref('');
  const refreshToken = ref(0);
  const missionRows = ref<RowData[]>([]);
  const missionIcons = ref<Record<string, string>>({});
  const project = useProjectStore();
  const feedback = useAppFeedback();

  const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
  const sessionId = computed(() => project.activeManifest?.sessionId ?? null);

  function handleSaved(missionId: string) {
    selectedMission.value = missionId;
    refreshToken.value += 1;
  }

  async function queryMissions() {
    if (!sessionId.value) {
      missionRows.value = [];
      missionIcons.value = {};
      return;
    }
    const entities = await listMissionEntities(sessionId.value);
    missionRows.value = entities.map((entity) => ({ ...asRowData(asRowData(entity.data).list), id: entity.id }));
    await queryMissionIcons(entities);
    const missions = missionRows.value.map((row) => String(row.mission ?? '').trim()).filter(Boolean);
    if (!selectedMission.value && missions[0]) selectedMission.value = missions[0];
    if (selectedMission.value && !missions.includes(selectedMission.value)) selectedMission.value = missions[0] ?? '';
  }

  async function queryMission(id: string) {
    if (!sessionId.value || !id) return null;
    return getMissionEntity(sessionId.value, id);
  }

  async function queryMissionIcon(id: string) {
    if (!sessionId.value || !id) return '';
    const entity = await getMissionEntity(sessionId.value, id);
    const resource = entity?.resourceRefs.icon ?? null;
    if (!resource) return '';
    return (await queryResourceDataUrlBatch(sessionId.value, [resource]))[0] ?? '';
  }

  async function createMission(id: string): Promise<boolean> {
    if (!modRoot.value) return false;
    await createIndexedConfigEntityWithFileHistory({
      modRoot: modRoot.value,
      kind: 'mission',
      nextId: id,
      indexRow: buildMissionIndexRow([], ['mission'], id),
      payload: { descriptor: { title: id }, text: '' },
    });
    selectedMission.value = id;
    feedback.success(`战役 "${id}" 已创建`);
    await queryMissions();
    return true;
  }

  async function saveMission(id: string, list: RowData, descriptor: RowData, text: string, previousId: string): Promise<string> {
    if (!modRoot.value) return previousId;
    await saveIndexedConfigEntityWithFileHistory({
      modRoot: modRoot.value,
      kind: 'mission',
      previousId: id !== previousId ? previousId : null,
      nextId: id,
      indexRow: buildMissionIndexRow([list], Object.keys(list).length ? Object.keys(list) : ['mission'], id),
      payload: { descriptor: deepClone(descriptor), text },
      deletePreviousTarget: id !== previousId,
    });
    selectedMission.value = id;
    feedback.success(`战役 "${id}" 已保存`);
    await queryMissions();
    return id;
  }

  async function deleteMission(id: string, deleteDirectory: boolean): Promise<boolean> {
    if (!modRoot.value) return false;
    await deleteIndexedConfigEntityWithFileHistory(modRoot.value, 'mission', id, deleteDirectory);
    feedback.success(`战役 "${id}" 已删除`);
    await queryMissions();
    if (selectedMission.value === id) {
      selectedMission.value = missionRows.value.map((row) => String(row.mission ?? '').trim()).filter(Boolean)[0] ?? '';
    }
    return true;
  }

  async function queryMissionIcons(entities: EntityData[] = []) {
    if (!sessionId.value) {
      missionIcons.value = {};
      return;
    }
    const iconEntities = entities.filter((entity) => entity.resourceRefs.icon);
    const dataUrls = await queryResourceDataUrlBatch(
      sessionId.value,
      iconEntities.map((entity) => entity.resourceRefs.icon),
    );
    missionIcons.value = Object.fromEntries(iconEntities.map((entity, index) => [entity.id, dataUrls[index] ?? '']));
  }

  return {
    selectedMission,
    refreshToken,
    missionRows,
    missionIcons,
    modRoot,
    sessionId,
    handleSaved,
    createMission,
    deleteMission,
    queryMissions,
    queryMission,
    queryMissionIcon,
    saveMission,
  };
}

function asRowData(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}
