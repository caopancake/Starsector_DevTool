<template>
  <div class="faction-editor-page">
    <header class="faction-editor-header">
      <h2>{{ displayName }}</h2>
      <div class="config-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteFaction">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">
          保存 {{ str(factionFile.id) || factionId }}.faction
        </n-button>
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
    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :app-data="project.activeModData" />

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deleteCurrentFaction"
    >
      <p>确定要删除势力 "{{ factionId }}" 吗？</p>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../project/project-store';
import { useSettingsStore } from '../../../app/settings-store';
import { deleteIndexedConfigEntityWithFileHistory, saveIndexedConfigEntityWithFileHistory } from '../config-save-orchestrator';
import { factionIndexRow, stripInternalFields } from '../config-service';
import { loadImageDataUrl } from '../../../shared/api/assets-api';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue, RowData } from '../../../shared/types';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { useCoreSchema } from '../../schema/composables/use-core-schema';
import { aggregateSchemaSources, splitSchemaSources } from '../../schema/schema-service';
import { createAppFeedback } from '../../../app/app-feedback';

const props = defineProps<{ factionId: string }>();
const emit = defineEmits<{ saved: [factionId: string] }>();

const project = useProjectStore();
const settings = useSettingsStore();

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();

const schema = computed(() => getMergedSchema('faction'));

const { message } = createAppFeedback(['message']);

const saving = ref(false);
const showDeleteDialog = ref(false);
const local = ref<RowData>({});
const factionFile = computed<RowData>(() => {
  const file = local.value.file;
  return file && typeof file === 'object' && !Array.isArray(file) ? (file as RowData) : {};
});

watch(
  () => props.factionId,
  (id) => {
    const modData = project.activeModData;
    if (modData && modData.factionFiles[id]) {
      local.value = aggregateSchemaSources({ file: deepClone(modData.factionFiles[id]) });
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
  const modRoot = project.activeModData?.modRoot;
  const coreRoot = settings.starsectorRoot || project.activeModData?.starsectorRoot || undefined;
  const logo = str(factionFile.value.logo);
  const crest = str(factionFile.value.crest);

  if (logo && modRoot) {
    try {
      logoSrc.value = (await loadImageDataUrl(modRoot, logo, coreRoot)) ?? '';
    } catch {
      logoSrc.value = '';
    }
  } else {
    logoSrc.value = '';
  }

  if (crest && modRoot) {
    try {
      crestSrc.value = (await loadImageDataUrl(modRoot, crest, coreRoot)) ?? '';
    } catch {
      crestSrc.value = '';
    }
  } else {
    crestSrc.value = '';
  }
}

watch(
  () => [str(factionFile.value.logo), str(factionFile.value.crest)],
  () => refreshImagePreviews(),
  { immediate: true },
);

// --- Save with ID rename support ---
async function save() {
  const modData = project.activeModData;
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
      indexRow: factionIndexRow(newId),
      payload: { file: stripInternalFields(file) as RowData },
      deletePreviousTarget: idChanged,
    });
    const payload = result.entityPayload;
    const savedFile = payload && typeof payload.file === 'object' && !Array.isArray(payload.file) ? (payload.file as RowData) : file;

    if (idChanged) {
      delete modData.factionFiles[previousId];
      delete modData.factionMeta[previousId];
    }

    modData.factionFiles[newId] = deepClone(savedFile);
    modData.factionMeta[newId] = {
      name: str(savedFile.displayName) || newId,
      color: rgbaToCss(savedFile.color),
    };

    emit('saved', newId);
    message.success(`${newId}.faction 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

function confirmDeleteFaction() {
  showDeleteDialog.value = true;
}

async function deleteCurrentFaction() {
  const modData = project.activeModData;
  if (!modData || !props.factionId) return false;
  try {
    await deleteIndexedConfigEntityWithFileHistory(modData.modRoot, 'faction', props.factionId, true);
    delete modData.factionFiles[props.factionId];
    delete modData.factionMeta[props.factionId];
    showDeleteDialog.value = false;
    emit('saved', '');
    message.success(`势力 "${props.factionId}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function rgbaToCss(color: JsonValue | undefined): string {
  if (Array.isArray(color) && color.length >= 3) {
    const r = Math.round(Number(color[0]) || 0);
    const g = Math.round(Number(color[1]) || 0);
    const b = Math.round(Number(color[2]) || 0);
    const a = Math.round(Number(color[3] ?? 255) || 0) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return 'rgba(128, 128, 128, 1)';
}
</script>
