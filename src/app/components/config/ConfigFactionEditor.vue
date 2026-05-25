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
    <SchemaFormRenderer v-if="schema" :schema="schema" v-model="local" :runtime-context="props.schemaRuntimeContext" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { deepClone } from '@/shared/lib/starsector';
import type { JsonValue, RowData, SchemaRuntimeContext } from '@/shared/types';
import type { FileSchema } from '@/domain/schema/schema.types';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { useCoreSchema } from '@/app/composables/use-core-schema';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { configFactionEditorModel } from '@/domain/config/config-entities';

const props = defineProps<{
  factionId: string;
  factions: Record<string, RowData>;
  queryPreviewImages: (factionId: string) => Promise<{ logoSrc: string; crestSrc: string }>;
  schemaRuntimeContext: SchemaRuntimeContext | null;
  saveFaction: (previousId: string, local: RowData, schema: FileSchema) => Promise<string>;
  deleteFaction: (id: string, deleteFile: boolean) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [factionId: string | null] }>();

const { getMergedSchema, loadCoreFields } = useCoreSchema();
loadCoreFields();

const schema = computed(() => getMergedSchema('faction'));
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
      local.value = configFactionEditorModel(deepClone(props.factions[id]));
    } else {
      local.value = configFactionEditorModel({ id });
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
  const images = await props.queryPreviewImages(props.factionId);
  logoSrc.value = images.logoSrc;
  crestSrc.value = images.crestSrc;
}

watch(
  () => [str(factionFile.value.logo), str(factionFile.value.crest)],
  () => refreshImagePreviews(),
  { immediate: true },
);

// --- Save with ID rename support ---
async function save() {
  const currentSchema = schema.value;
  if (!currentSchema) return;
  saving.value = true;
  try {
    emit('saved', await props.saveFaction(props.factionId, local.value, currentSchema));
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
  if (!props.factionId) return false;
  try {
    await props.deleteFaction(props.factionId, true);
    emit('saved', null);
  } catch (error) {
    feedback.error(error, '删除势力失败');
    return false;
  }
  return true;
}
</script>
