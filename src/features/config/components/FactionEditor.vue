<template>
  <div class="faction-editor-page">
    <header class="faction-editor-header">
      <h2>{{ displayName }}</h2>
      <n-button type="primary" size="small" :loading="saving" @click="save"> 保存 {{ str(factionFile.id) || factionId }}.faction </n-button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project-store';
import { recordFileSave } from '../../file-history/file-save-orchestrator';
import { useSettingsStore } from '../../../app/settings-store';
import { saveFactionData } from '../config-service';
import { loadImageDataUrl } from '../../../shared/api/assets-api';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue, RowData } from '../../../shared/types';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { useCoreSchema } from '../../schema/composables/use-core-schema';
import { aggregateSchemaSources, splitSchemaSources } from '../../schema/schema-service';
import { buildThemeOverrides, discreteConfigProviderProps } from '../../../app/theme-overrides';

const props = defineProps<{ factionId: string }>();

const project = useProjectStore();
const settings = useSettingsStore();
const themeOverrides = computed(() => buildThemeOverrides(settings));

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();

const schema = computed(() => getMergedSchema('faction'));

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

const saving = ref(false);
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
    const oldId = props.factionId;
    const idChanged = newId !== oldId;

    const changes = await saveFactionData(modData.modRoot, newId, file, idChanged ? oldId : null, idChanged);

    if (idChanged) {
      delete modData.factionFiles[oldId];
      delete modData.factionMeta[oldId];
    }

    modData.factionFiles[newId] = deepClone(file);
    modData.factionMeta[newId] = {
      name: str(file.displayName) || newId,
      color: rgbaToCss(file.color),
    };

    recordFileSave(modData.modRoot, changes, `保存 ${newId}.faction`);
    message.success(`${newId}.faction 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
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
