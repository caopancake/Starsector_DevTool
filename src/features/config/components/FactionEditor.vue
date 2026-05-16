<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>势力编辑 — {{ displayName }}</h1>
    </header>

    <!-- Logo/Crest preview section (special, not in schema) -->
    <section v-if="logoSrc || crestSrc" class="settings-section">
      <h3>图标预览</h3>
      <div class="faction-previews">
        <div v-if="logoSrc" class="faction-preview-item">
          <span>Logo</span>
          <img :src="logoSrc" class="faction-icon-preview" />
        </div>
        <div v-if="crestSrc" class="faction-preview-item">
          <span>Crest</span>
          <img :src="crestSrc" class="faction-icon-preview" />
        </div>
      </div>
    </section>

    <!-- Schema-driven form -->
    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :app-data="project.activeModData" />

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save"> 保存 {{ str(local.id) || factionId }}.faction </n-button>
    </footer>
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
.faction-previews {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.faction-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.faction-icon-preview {
  max-width: 64px;
  max-height: 64px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  image-rendering: pixelated;
}
</style>
