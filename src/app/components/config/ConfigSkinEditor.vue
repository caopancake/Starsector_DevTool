<template>
  <main v-if="selectedSkin && schema" class="skin-editor">
    <header class="skin-editor-header">
      <div>
        <h3>{{ selectedSkin.skinHullId }}</h3>
        <p>{{ selectedSkin.relPath }}</p>
      </div>
      <div class="skin-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteSkin">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存</n-button>
      </div>
    </header>
    <div class="skin-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="localSkin" :runtime-context="schemaRuntimeContext" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useProjectStore } from '@/stores/project.store';
import type { RowData, SkinFile } from '@/shared/types';
import { deepClone } from '@/shared/lib/starsector';
import SchemaFormRenderer from '@/app/components/schema/SchemaFormRenderer.vue';
import { getSchema } from '@/domain/schema/schema-registry';
import { useSchemaRuntimeContext } from '@/app/composables/use-schema-runtime-context';

const props = defineProps<{
  skinHullId: string;
  skins: SkinFile[];
  saveSkin: (current: SkinFile, data: RowData) => Promise<SkinFile | null>;
  deleteSkin: (skin: SkinFile) => Promise<boolean>;
}>();
const emit = defineEmits<{ saved: [skinHullId: string | null] }>();

const project = useProjectStore();
const feedback = useAppFeedback();

const localSkin = ref<RowData>({});
const saving = ref(false);

const schema = computed(() => getSchema('skin'));
const schemaRuntimeContext = useSchemaRuntimeContext(() => project.activeManifest);
const skins = computed(() => [...props.skins]);
const selectedSkin = computed(() => skins.value.find((skin) => skin.skinHullId === props.skinHullId) ?? null);

async function save() {
  const current = selectedSkin.value;
  if (!current) return;
  saving.value = true;
  try {
    const saved = await props.saveSkin(current, localSkin.value);
    if (!saved) return;
    localSkin.value = deepClone(saved.data);
    emit('saved', saved.skinHullId);
  } catch (error) {
    feedback.error(error, '保存舰船皮肤失败');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteSkin() {
  const current = selectedSkin.value;
  if (!current) return;
  feedback.confirmDanger({
    title: '删除舰船皮肤',
    content: `确定要删除舰船皮肤 "${current.skinHullId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deleteCurrentSkin();
    },
  });
}

async function deleteCurrentSkin() {
  const current = selectedSkin.value;
  if (!current) return false;
  try {
    if (!(await props.deleteSkin(current))) return false;
    const nextId = skins.value.find((skin) => skin.skinHullId !== current.skinHullId)?.skinHullId ?? null;
    emit('saved', nextId);
  } catch (error) {
    feedback.error(error, '删除舰船皮肤失败');
    return false;
  }
  return true;
}

watch(
  selectedSkin,
  (skin) => {
    localSkin.value = skin ? deepClone(skin.data) : {};
  },
  { immediate: true },
);
</script>
