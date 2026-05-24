<template>
  <div class="faction-editor-page">
    <header class="faction-editor-header">
      <h2>{{ displayName }}</h2>
      <div class="config-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteFaction">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>

    <!-- Logo/Crest preview -->
    <div v-if="logoSrc || crestSrc" class="faction-previews">
      <div v-if="logoSrc" class="faction-preview-item faction-preview-logo">
        <span>Logo</span>
        <img :src="logoSrc" class="faction-full-preview" />
      </div>
      <div v-if="crestSrc" class="faction-preview-item faction-preview-crest">
        <span>Crest</span>
        <img :src="crestSrc" class="faction-full-preview" />
      </div>
    </div>

    <!-- Schema-driven form -->
    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :runtime-context="schemaRuntimeContext" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { deleteIndexedConfigEntityWithFileHistory, saveIndexedConfigEntityWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { buildFactionIndexRow, stripSchemaInternalFields } from '@/domain/config/config-entities';
import { queryResourceDataUrlBatch } from '@/services/resource-cache.service';
import { deepClone } from '@/shared/lib/starsector';
import type { JsonValue, ResourceRef, RowData } from '@/shared/types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { aggregateSchemaSources, splitSchemaSources } from '@/domain/schema/schema-registry';
import { useAppFeedback } from '@/app/composables/use-app-feedback';

const props = defineProps<{ factionId: string; factions: Record<string, RowData> }>();
const emit = defineEmits<{ saved: [factionId: string]; changed: [] }>();

const project = useProjectStore();

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();

const schema = computed(() => getMergedSchema('faction'));
const schemaRuntimeContext = computed(() =>
  project.activeManifest ? { modRoot: project.activeManifest.modRoot, sessionId: project.activeManifest.sessionId } : null,
);

const feedback = useAppFeedback();

const saving = ref(false);
const local = ref<RowData>({});
const factionFile = computed<RowData>(() => {
  const file = local.value.file;
  return file && typeof file === 'object' && !Array.isArray(file) ? (file as RowData) : {};
});

watch(
  () => props.factionId,
  (id) => {
    if (props.factions[id]) {
      local.value = aggregateSchemaSources({ file: deepClone(props.factions[id]) });
    } else {
      local.value = aggregateSchemaSources({ file: { id } });
    }
  },
  { immediate: true },
);

function str(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const displayName = computed(() => str(factionFile.value.displayName) || props.factionId);

// --- Image preview ---
const logoSrc = ref('');
const crestSrc = ref('');

async function refreshImagePreviews() {
  const manifest = project.activeManifest;
  const logo = str(factionFile.value.logo);
  const crest = str(factionFile.value.crest);
  const resources = [
    logo ? factionResourceRef(props.factionId, logo, 'logo') : null,
    crest ? factionResourceRef(props.factionId, crest, 'crest') : null,
  ].filter((resource): resource is ResourceRef => Boolean(resource));

  if (!manifest || resources.length === 0) {
    logoSrc.value = '';
    crestSrc.value = '';
    return;
  }
  const dataUrls = await queryResourceDataUrlBatch(manifest.sessionId, resources);
  logoSrc.value = logo ? (dataUrls.shift() ?? '') : '';
  crestSrc.value = crest ? (dataUrls.shift() ?? '') : '';
}

function factionResourceRef(id: string, relPath: string, key: string): ResourceRef {
  return { source: 'mod', relPath, ownerKind: 'faction', ownerId: id, key };
}

watch(
  () => [str(factionFile.value.logo), str(factionFile.value.crest)],
  () => refreshImagePreviews(),
  { immediate: true },
);

// --- Save with ID rename support ---
async function save() {
  const modData = project.activeManifest;
  if (!modData) return;
  const currentSchema = schema.value;
  if (!currentSchema) return;
  saving.value = true;
  try {
    const split = splitSchemaSources(local.value, currentSchema);
    const file = split.file && typeof split.file === 'object' && !Array.isArray(split.file) ? (split.file as RowData) : {};
    const newId = str(file.id) || props.factionId;
    const previousId = props.factionId;
    const idChanged = newId !== previousId;

    const result = await saveIndexedConfigEntityWithFileHistory({
      modRoot: modData.modRoot,
      kind: 'faction',
      previousId: idChanged ? previousId : null,
      nextId: newId,
      indexRow: buildFactionIndexRow(newId),
      payload: { file: stripSchemaInternalFields(file) as RowData },
      deletePreviousTarget: idChanged,
    });
    void result;
    emit('changed');
    emit('saved', newId);
    feedback.success(`势力 "${newId}" 已保存`);
  } catch (error) {
    feedback.error(error, '保存势力失败');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteFaction() {
  feedback.confirmDanger({
    title: '删除势力',
    content: `确定要删除势力 "${props.factionId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteCurrentFaction();
    },
  });
}

async function deleteCurrentFaction() {
  const modData = project.activeManifest;
  if (!modData || !props.factionId) return false;
  try {
    await deleteIndexedConfigEntityWithFileHistory(modData.modRoot, 'faction', props.factionId, true);
    emit('changed');
    emit('saved', '');
    feedback.success(`势力 "${props.factionId}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除势力失败');
    return false;
  }
  return true;
}
</script>
