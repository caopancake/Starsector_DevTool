<template>
  <main v-if="selectedSkin && schema" class="skin-editor">
    <header class="skin-editor-header">
      <div>
        <h3>{{ selectedSkin.skinHullId }}</h3>
        <p>{{ selectedSkin.relPath }}</p>
      </div>
      <div class="skin-editor-actions">
        <n-button size="small" secondary type="error" @click="confirmDeleteSkin">删除</n-button>
        <n-button type="primary" size="small" :loading="saving" @click="save">保存舰船皮肤</n-button>
      </div>
    </header>
    <div class="skin-editor-body">
      <SchemaFormRenderer :schema="schema" v-model="localSkin" :app-data="project.activeModData" />
    </div>

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deleteCurrentSkin"
    >
      <p>确定要删除舰船皮肤 "{{ selectedSkin.skinHullId }}" 吗？</p>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createAppFeedback } from '../../../app/app-feedback';
import { useProjectStore } from '../../project/project-store';
import type { RowData } from '../../../shared/types';
import { deepClone } from '../../../shared/lib/starsector';
import SchemaFormRenderer from '../../schema/components/SchemaFormRenderer.vue';
import { getSchema } from '../../schema/schema-service';
import { formatError } from '../../../shared/lib/errors';
import { deleteSkinWithFileHistory, saveSkinWithFileHistory } from '../config-save-orchestrator';
import { isSafeFileStem } from '../config-service';

const props = defineProps<{ skinHullId: string }>();
const emit = defineEmits<{ saved: [skinHullId: string] }>();

const project = useProjectStore();
const { message } = createAppFeedback(['message']);

const localSkin = ref<RowData>({});
const saving = ref(false);
const showDeleteDialog = ref(false);

const schema = computed(() => getSchema('skin'));
const modData = computed(() => project.activeModData);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const skins = computed(() => [...(modData.value?.skinFiles ?? [])]);
const selectedSkin = computed(() => skins.value.find((skin) => skin.skinHullId === props.skinHullId) ?? null);

async function save() {
  const current = selectedSkin.value;
  if (!current || !modRoot.value) return;
  const nextSkinHullId = stringField(localSkin.value, 'skinHullId');
  const nextBaseHullId = stringField(localSkin.value, 'baseHullId');
  if (!nextSkinHullId || !nextBaseHullId) {
    message.warning('skinHullId 和 baseHullId 不能为空');
    return;
  }
  if (!isSafeFileStem(nextSkinHullId)) {
    message.error('skinHullId 不能包含路径分隔符或 ..');
    return;
  }
  if (skins.value.some((skin) => skin.skinHullId === nextSkinHullId && skin.skinHullId !== current.skinHullId)) {
    message.warning(`舰船皮肤 "${nextSkinHullId}" 已存在`);
    return;
  }
  saving.value = true;
  try {
    const renamed = nextSkinHullId !== current.skinHullId;
    const result = await saveSkinWithFileHistory(
      modRoot.value,
      nextSkinHullId,
      localSkin.value,
      renamed ? current.skinHullId : null,
      renamed ? current.relPath : null,
    );
    project.upsertSkinFile(modRoot.value, result.skinFile, current.skinHullId);
    localSkin.value = deepClone(result.skinFile.data);
    emit('saved', result.skinFile.skinHullId);
    message.success(`舰船皮肤 "${result.skinFile.skinHullId}" 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}

function confirmDeleteSkin() {
  showDeleteDialog.value = true;
}

async function deleteCurrentSkin() {
  const current = selectedSkin.value;
  if (!current || !modRoot.value) return false;
  try {
    await deleteSkinWithFileHistory(modRoot.value, current.relPath, current.skinHullId);
    project.deleteSkinFile(modRoot.value, current.skinHullId);
    showDeleteDialog.value = false;
    emit('saved', skins.value[0]?.skinHullId ?? '');
    message.success(`舰船皮肤 "${current.skinHullId}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

watch(
  selectedSkin,
  (skin) => {
    localSkin.value = skin ? deepClone(skin.data) : {};
  },
  { immediate: true },
);
</script>
