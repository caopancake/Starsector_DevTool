<template>
  <div class="faction-editor-page">
    <header class="faction-editor-header">
      <h2>{{ displayName }}</h2>
      <n-button type="primary" size="small" :loading="saving" @click="save"> 保存 {{ str(local.id) || factionId }}.faction </n-button>
    </header>

    <!-- Logo/Crest preview -->
    <div v-if="logoSrc || crestSrc" class="faction-previews">
      <div v-if="logoSrc" class="faction-preview-item">
        <span>Logo</span>
        <img :src="logoSrc" class="faction-icon-preview" />
      </div>
      <div v-if="crestSrc" class="faction-preview-item">
        <span>Crest</span>
        <img :src="crestSrc" class="faction-icon-preview" />
      </div>
    </div>

    <!-- Schema-driven form -->
    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :app-data="project.activeModData" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useHistoryStore } from '../../history/history.store';
import { useSettingsStore } from '../../../app/settings.store';
import { saveFactionData, deleteFactionFile } from '../config.service';
import { loadImageDataUrl } from '../../../shared/api/tauri';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue, RowData } from '../../../shared/types';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { useCoreSchema } from '../../schema/composables/useCoreSchema';

const props = defineProps<{ factionId: string }>();

const project = useProjectStore();
const historyStore = useHistoryStore();
const settings = useSettingsStore();

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();
const schema = computed(() => getMergedSchema('faction'));

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const saving = ref(false);
const local = ref<RowData>({});

watch(
  () => props.factionId,
  (id) => {
    const modData = project.activeModData;
    if (modData && modData.factionFiles[id]) {
      local.value = deepClone(modData.factionFiles[id]);
    } else {
      local.value = { id };
    }
  },
  { immediate: true },
);

function str(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const displayName = computed(() => str(local.value.displayName) || props.factionId);

// --- Image preview ---
const logoSrc = ref('');
const crestSrc = ref('');

async function refreshImagePreviews() {
  const modRoot = project.activeModData?.modRoot;
  const logo = str(local.value.logo);
  const crest = str(local.value.crest);

  if (logo && modRoot) {
    try {
      logoSrc.value = (await loadImageDataUrl(modRoot, logo)) ?? '';
    } catch {
      logoSrc.value = '';
    }
  } else {
    logoSrc.value = '';
  }

  if (crest && modRoot) {
    try {
      crestSrc.value = (await loadImageDataUrl(modRoot, crest)) ?? '';
    } catch {
      crestSrc.value = '';
    }
  } else {
    crestSrc.value = '';
  }
}

watch(
  () => [str(local.value.logo), str(local.value.crest)],
  () => refreshImagePreviews(),
  { immediate: true },
);

// --- Save with ID rename support ---
async function save() {
  const modData = project.activeModData;
  if (!modData) return;
  saving.value = true;
  try {
    const newId = str(local.value.id) || props.factionId;
    const oldId = props.factionId;
    const idChanged = newId !== oldId;

    const previousSpec = deepClone(modData.factionFiles[oldId] ?? {});

    // Save with new ID (backend writes to {newId}.faction)
    await saveFactionData(modData.modRoot, newId, local.value);

    if (idChanged) {
      // Delete old faction file
      await deleteFactionFile(modData.modRoot, oldId);
      // Update factionFiles map: remove old, add new
      delete modData.factionFiles[oldId];
    }

    modData.factionFiles[newId] = deepClone(local.value);

    historyStore.pushEvent(
      { type: 'editor-save', editorKind: 'ship', id: newId, previousSpec, newSpec: deepClone(local.value) },
      `保存 ${newId}.faction`,
    );
    historyStore.pushCheckpoint('editor-save', `${newId}.faction 已保存`);
    message.success(`${newId}.faction 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.faction-editor-page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
  background: var(--color-panel-muted);
}

.faction-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.faction-editor-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.faction-previews {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.faction-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--color-muted);
}

.faction-icon-preview {
  max-width: 48px;
  max-height: 48px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  image-rendering: pixelated;
}
</style>
