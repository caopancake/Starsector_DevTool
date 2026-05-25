import { onMounted, ref, watch } from 'vue';
import { listConfigFactionRecords, queryConfigFactionPreviewImages } from '@/services/config-entity.service';
import {
  createIndexedConfigEntityAction,
  deleteIndexedConfigEntityAction,
  saveIndexedConfigEntityAction,
} from '@/orchestrators/config-save.orchestrator';
import { buildFactionIndexRow, configFactionSaveDraft, createDefaultFaction, isConfigEntityId } from '@/domain/config/config-entities';
import type { FileSchema } from '@/domain/schema/schema.types';
import type { RowData } from '@/shared/types';
import { useProjectStore } from '@/stores/project.store';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';

export function useConfigFactionViewModel() {
  const selectedFaction = ref<string | null>(null);
  const factions = ref<Record<string, RowData>>({});
  const factionCrests = ref<Record<string, string>>({});
  const project = useProjectStore();
  const feedback = useAppFeedback();
  const schemaRuntimeContext = useSchemaRuntimeContext(() => project.activeManifest);

  async function loadFactions() {
    const sessionId = project.activeSessionId;
    const manifest = project.activeManifest;
    if (!sessionId || !manifest) {
      factions.value = {};
      factionCrests.value = {};
      selectedFaction.value = null;
      return;
    }
    const records = await listConfigFactionRecords(sessionId);
    factions.value = Object.fromEntries(records.map((record) => [record.id, record.data]));
    factionCrests.value = Object.fromEntries(records.map((record) => [record.id, record.crestSrc]));
    project.updateEntitySummary(manifest.modRoot, 'factions', records.length);
    if (selectedFaction.value && !factions.value[selectedFaction.value]) selectedFaction.value = null;
    if (!selectedFaction.value) selectedFaction.value = Object.keys(factions.value).sort()[0] ?? null;
  }

  async function onSaved(id: string | null) {
    selectedFaction.value = id;
    await loadFactions();
  }

  async function createFaction(id: string): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
    if (!isConfigEntityId(id)) {
      feedback.error('势力 ID 不能包含路径分隔符或 ..');
      return false;
    }
    await createIndexedConfigEntityAction({
      modRoot: manifest.modRoot,
      kind: 'faction',
      previousId: null,
      nextId: id,
      indexRow: buildFactionIndexRow(id),
      entityData: { file: createDefaultFaction(id) },
      deletePreviousTarget: false,
    });
    feedback.success(`势力 "${id}" 已创建`);
    selectedFaction.value = id;
    await loadFactions();
    return true;
  }

  async function saveFaction(previousId: string, local: RowData, schema: FileSchema): Promise<string> {
    const manifest = project.activeManifest;
    if (!manifest) return previousId;
    const draft = configFactionSaveDraft(local, schema);
    const nextId = draft.nextId;
    if (!isConfigEntityId(nextId)) {
      feedback.error('势力 ID 不能包含路径分隔符或 ..');
      return previousId;
    }
    const idChanged = nextId !== previousId;
    await saveIndexedConfigEntityAction({
      modRoot: manifest.modRoot,
      kind: 'faction',
      previousId: idChanged ? previousId : null,
      nextId,
      indexRow: buildFactionIndexRow(nextId),
      entityData: { file: draft.file },
      deletePreviousTarget: idChanged,
    });
    feedback.success(`势力 "${nextId}" 已保存`);
    selectedFaction.value = nextId;
    await loadFactions();
    return nextId;
  }

  async function deleteFaction(id: string, deleteFile: boolean): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
    await deleteIndexedConfigEntityAction(manifest.modRoot, 'faction', id, deleteFile);
    feedback.success(`势力 "${id}" 已删除`);
    if (selectedFaction.value === id) selectedFaction.value = null;
    await loadFactions();
    return true;
  }

  onMounted(loadFactions);
  watch(() => project.activeSessionId, loadFactions);

  async function queryFactionPreviewImages(factionId: string) {
    const manifest = project.activeManifest;
    return manifest ? queryConfigFactionPreviewImages(manifest.sessionId, factionId) : { logoSrc: '', crestSrc: '' };
  }

  return {
    selectedFaction,
    factions,
    factionCrests,
    schemaRuntimeContext,
    createFaction,
    deleteFaction,
    loadFactions,
    onSaved,
    queryFactionPreviewImages,
    saveFaction,
  };
}
