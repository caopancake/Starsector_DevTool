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
        <n-select
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

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      positive-text="删除"
      negative-text="取消"
      type="error"
      @positive-click="deletePendingSkin"
    >
      <p>确定要删除舰船皮肤 "{{ pendingDeleteSkin?.skinHullId }}" 吗？</p>
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { createAppFeedback } from '../../../app/app-feedback';
import { useProjectStore } from '../../project/project-store';
import type { SkinFile } from '../../../shared/types';
import { formatError } from '../../../shared/lib/errors';
import type { SelectOption } from '../../schema/schema-service';
import { resolveSource } from '../../schema/schema-service';
import { createSkinWithFileHistory, deleteSkinWithFileHistory } from '../config-save-orchestrator';
import { isSafeFileStem } from '../config-service';
import { resolveHullSprite } from '../../../shared/lib/hull-references';

const props = defineProps<{ selectedId: string }>();
const emit = defineEmits<{ select: [skinHullId: string] }>();

const project = useProjectStore();
const { message } = createAppFeedback(['message']);

const showCreateDialog = ref(false);
const newBaseHullId = ref('');
const newSkinHullId = ref('');
const showDeleteDialog = ref(false);
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
    message.warning('baseHullId 和 skinHullId 不能为空');
    return false;
  }
  if (!isSafeFileStem(skinHullId)) {
    message.error('skinHullId 不能包含路径分隔符或 ..');
    return false;
  }
  if (skins.value.some((skin) => skin.skinHullId === skinHullId)) {
    message.warning(`舰船皮肤 "${skinHullId}" 已存在`);
    return false;
  }
  try {
    const result = await createSkinWithFileHistory(modRoot.value, baseHullId, skinHullId);
    project.upsertSkinFile(modRoot.value, result.skinFile);
    showCreateDialog.value = false;
    newBaseHullId.value = '';
    newSkinHullId.value = '';
    emit('select', skinHullId);
    message.success(`舰船皮肤 "${skinHullId}" 已创建`);
  } catch (error) {
    message.error(formatError(error));
    return false;
  }
  return true;
}

function confirmDeleteSkin(skin: SkinFile) {
  pendingDeleteSkin.value = skin;
  showDeleteDialog.value = true;
}

async function deletePendingSkin() {
  const skin = pendingDeleteSkin.value;
  if (!skin || !modRoot.value) return false;
  try {
    await deleteSkinWithFileHistory(modRoot.value, skin.relPath, skin.skinHullId);
    project.deleteSkinFile(modRoot.value, skin.skinHullId);
    pendingDeleteSkin.value = null;
    showDeleteDialog.value = false;
    if (props.selectedId === skin.skinHullId) {
      emit('select', skins.value[0]?.skinHullId ?? '');
    }
    message.success(`舰船皮肤 "${skin.skinHullId}" 已删除`);
  } catch (error) {
    message.error(formatError(error));
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
