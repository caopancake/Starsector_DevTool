<template>
  <aside class="skin-list config-entity-list">
    <header class="skin-list-header config-entity-list-header">
      <h3>舰船皮肤列表</h3>
    </header>
    <ul class="skin-list-items config-entity-list-items">
      <li v-if="skins.length === 0" class="skin-list-empty config-entity-list-empty">未找到 data/hulls/skins 下的 .skin 文件。</li>
      <li
        v-for="skin in skins"
        :key="skin.skinHullId"
        class="skin-list-item config-entity-list-item"
        :class="{ active: skin.skinHullId === selectedId }"
        @click="emit('select', skin.skinHullId)"
      >
        <span class="skin-list-preview config-entity-thumb">
          <img v-if="skinSprite(skin)" :src="skinSprite(skin)" alt="" />
          <svg v-else class="skin-list-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5 18l7 3 7-3-7-15z" />
            <path d="M8 16h8M9 12h6" />
          </svg>
        </span>
        <span class="skin-list-text">
          <span class="config-entity-name">{{ skin.skinHullId }}</span>
          <small>{{ skin.baseHullId }}</small>
        </span>
        <n-button
          size="tiny"
          quaternary
          class="skin-delete-btn config-entity-delete compact-icon-button"
          title="删除舰船皮肤"
          @click.stop="confirmDeleteSkin(skin)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </n-button>
      </li>
    </ul>
    <footer class="skin-list-footer config-entity-list-footer">
      <n-button size="small" block @click="showCreateDialog = true">新建舰船皮肤</n-button>
    </footer>

    <n-modal
      v-model:show="showCreateDialog"
      preset="dialog"
      title="新建舰船皮肤"
      positive-text="创建"
      negative-text="取消"
      @positive-click="createSkin"
    >
      <div class="variant-dialog-fields">
        <n-input v-if="settings.isPlainEditMode" v-model:value="newBaseHullId" placeholder="baseHullId" />
        <n-select
          v-else
          v-model:value="newBaseHullId"
          :options="hullOptions"
          :render-label="renderHullOptionLabel"
          filterable
          tag
          placeholder="baseHullId"
        />
        <n-input v-model:value="newSkinHullId" placeholder="skinHullId" />
      </div>
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { SkinFile } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-registry';
import { resolveSource } from '@/domain/schema/schema-registry';
import { createSkinWithFileHistory, deleteSkinWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { isSafeEntityFileStem } from '@/domain/config/config-entities';
import { resolveHullSprite } from '@/shared/lib/hull-references';

const props = defineProps<{ selectedId: string }>();
const emit = defineEmits<{ select: [skinHullId: string] }>();

const project = useProjectStore();
const feedback = useAppFeedback();
const settings = useSettingsStore();

const showCreateDialog = ref(false);
const newBaseHullId = ref('');
const newSkinHullId = ref('');
const pendingDeleteSkin = ref<SkinFile | null>(null);

const modData = computed(() => project.activeModData);
const modRoot = computed(() => modData.value?.modRoot ?? '');
const skins = computed(() => [...(modData.value?.skinFiles ?? [])].sort(compareSkins));
const hullOptions = computed(() => resolveSource('csv:ships.id', modData.value ?? null));

async function createSkin() {
  const baseHullId = newBaseHullId.value.trim();
  const skinHullId = newSkinHullId.value.trim();
  if (!modRoot.value) return false;
  if (!baseHullId || !skinHullId) {
    feedback.warning('baseHullId 和 skinHullId 不能为空');
    return false;
  }
  if (!isSafeEntityFileStem(skinHullId)) {
    feedback.error('skinHullId 不能包含路径分隔符或 ..');
    return false;
  }
  if (skins.value.some((skin) => skin.skinHullId === skinHullId)) {
    feedback.warning(`舰船皮肤 "${skinHullId}" 已存在`);
    return false;
  }
  try {
    const result = await createSkinWithFileHistory(modRoot.value, baseHullId, skinHullId);
    project.upsertSkinFile(modRoot.value, result.skinFile);
    showCreateDialog.value = false;
    newBaseHullId.value = '';
    newSkinHullId.value = '';
    emit('select', skinHullId);
    feedback.success(`舰船皮肤 "${skinHullId}" 已创建`);
  } catch (error) {
    feedback.error(error, '创建舰船皮肤失败');
    return false;
  }
  return true;
}

function confirmDeleteSkin(skin: SkinFile) {
  pendingDeleteSkin.value = skin;
  feedback.confirmDanger({
    title: '删除舰船皮肤',
    content: `确定要删除舰船皮肤 "${skin.skinHullId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await deletePendingSkin();
    },
  });
}

async function deletePendingSkin() {
  const skin = pendingDeleteSkin.value;
  if (!skin || !modRoot.value) return false;
  try {
    await deleteSkinWithFileHistory(modRoot.value, skin.relPath, skin.skinHullId);
    project.deleteSkinFile(modRoot.value, skin.skinHullId);
    pendingDeleteSkin.value = null;
    if (props.selectedId === skin.skinHullId) {
      emit('select', skins.value[0]?.skinHullId ?? '');
    }
    feedback.success(`舰船皮肤 "${skin.skinHullId}" 已删除`);
  } catch (error) {
    feedback.error(error, '删除舰船皮肤失败');
    return false;
  }
  return true;
}

function compareSkins(a: SkinFile, b: SkinFile): number {
  return a.baseHullId.localeCompare(b.baseHullId) || a.skinHullId.localeCompare(b.skinHullId);
}

function skinSprite(skin: SkinFile): string {
  return resolveHullSprite(modData.value, skin.skinHullId) || resolveHullSprite(modData.value, skin.baseHullId);
}

function renderHullOptionLabel(option: SelectOption & { label?: string; value?: string; sprite?: string }) {
  if (!option.sprite) return option.label ?? option.value ?? '';
  return h('span', { class: 'schema-select-option' }, [
    h('img', {
      src: option.sprite,
      class: 'schema-select-option-thumb',
    }),
    h('span', { class: 'schema-select-option-label' }, option.label ?? option.value ?? ''),
  ]);
}

watch(
  skins,
  (items) => {
    if (items.length === 0) {
      emit('select', '');
      return;
    }
    if (!items.some((skin) => skin.skinHullId === props.selectedId)) {
      emit('select', items[0].skinHullId);
    }
  },
  { immediate: true },
);
</script>
