import { computed, onMounted, ref, watch } from 'vue';
import { getFactionEntityRecord, listFactionEntityRecords } from '@/services/config-entity.service';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import {
  createIndexedConfigEntityWithFileHistory,
  deleteIndexedConfigEntityWithFileHistory,
  saveIndexedConfigEntityWithFileHistory,
} from '@/orchestrators/config-save.orchestrator';
import { buildFactionIndexRow, createDefaultFaction, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { splitSchemaSources } from '@/domain/schema/schema-registry';
import type { FileSchema } from '@/domain/schema/schema.types';
import type { ResourceRef, RowData } from '@/shared/types';
import { useProjectStore } from '@/stores/project.store';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

export function useConfigFactionViewModel() {
  const selectedFaction = ref('');
  const factions = ref<Record<string, RowData>>({});
  const factionResourceRefs = ref<Record<string, Record<string, ResourceRef>>>({});
  const factionCrests = ref<Record<string, string>>({});
  const project = useProjectStore();
  const feedback = useAppFeedback();
  const schemaRuntimeContext = computed(() =>
    project.activeManifest ? { modRoot: project.activeManifest.modRoot, sessionId: project.activeManifest.sessionId } : null,
  );

  async function loadFactions() {
    const sessionId = project.activeSessionId;
    if (!sessionId) {
      factions.value = {};
      selectedFaction.value = '';
      return;
    }
    const entities = await listFactionEntityRecords(sessionId);
    factions.value = Object.fromEntries(entities.map((entity) => [entity.id, asRowData(entity.data)]));
    factionResourceRefs.value = Object.fromEntries(entities.map((entity) => [entity.id, entity.resourceRefs]));
    await refreshFactionCrests();
    if (selectedFaction.value && !factions.value[selectedFaction.value]) selectedFaction.value = '';
    if (!selectedFaction.value) selectedFaction.value = Object.keys(factions.value).sort()[0] ?? '';
  }

  async function onSaved(id: string) {
    selectedFaction.value = id;
    await loadFactions();
  }

  async function createFaction(id: string): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
    await createIndexedConfigEntityWithFileHistory({
      modRoot: manifest.modRoot,
      kind: 'faction',
      nextId: id,
      indexRow: buildFactionIndexRow(id),
      payload: { file: createDefaultFaction(id) },
    });
    feedback.success(`势力 "${id}" 已创建`);
    selectedFaction.value = id;
    await loadFactions();
    return true;
  }

  async function saveFaction(previousId: string, local: RowData, schema: FileSchema): Promise<string> {
    const manifest = project.activeManifest;
    if (!manifest) return previousId;
    const split = splitSchemaSources(local, schema);
    const file = split.file && typeof split.file === 'object' && !Array.isArray(split.file) ? (split.file as RowData) : {};
    const nextId = stringValue(file.id) || previousId;
    const idChanged = nextId !== previousId;
    await saveIndexedConfigEntityWithFileHistory({
      modRoot: manifest.modRoot,
      kind: 'faction',
      previousId: idChanged ? previousId : null,
      nextId,
      indexRow: buildFactionIndexRow(nextId),
      payload: { file: stripSchemaInternalFields(file) as RowData },
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
    await deleteIndexedConfigEntityWithFileHistory(manifest.modRoot, 'faction', id, deleteFile);
    feedback.success(`势力 "${id}" 已删除`);
    if (selectedFaction.value === id) selectedFaction.value = '';
    await loadFactions();
    return true;
  }

  onMounted(loadFactions);
  watch(() => project.activeSessionId, loadFactions);

  async function refreshFactionCrests() {
    const manifest = project.activeManifest;
    if (!manifest) {
      factionCrests.value = {};
      return;
    }
    const entries = Object.entries(factionResourceRefs.value)
      .map(([id, refs]) => (refs.crest ? { id, resource: refs.crest } : null))
      .filter((entry): entry is { id: string; resource: ResourceRef } => Boolean(entry));
    const dataUrls = await queryResourceDataUrlBatch(
      manifest.sessionId,
      entries.map((entry) => entry.resource),
    );
    factionCrests.value = Object.fromEntries(entries.map((entry, index) => [entry.id, dataUrls[index] ?? '']));
  }

  async function queryFactionPreviewImages(factionId: string) {
    const manifest = project.activeManifest;
    const entity =
      (manifest && (await getFactionEntityRecord(manifest.sessionId, factionId))) ??
      (factionResourceRefs.value[factionId]
        ? { kind: 'faction', id: factionId, data: factions.value[factionId] ?? {}, resourceRefs: factionResourceRefs.value[factionId] }
        : null);
    const resources = [entity?.resourceRefs.logo ?? null, entity?.resourceRefs.crest ?? null].filter((resource): resource is ResourceRef =>
      Boolean(resource),
    );
    if (!manifest || resources.length === 0) return { logoSrc: '', crestSrc: '' };
    const dataUrls = await queryResourceDataUrlBatch(manifest.sessionId, resources);
    return {
      logoSrc: entity?.resourceRefs.logo ? (dataUrls.shift() ?? '') : '',
      crestSrc: entity?.resourceRefs.crest ? (dataUrls.shift() ?? '') : '',
    };
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

function asRowData(value: unknown): RowData {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
