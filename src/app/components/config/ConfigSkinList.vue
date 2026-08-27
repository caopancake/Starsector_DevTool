<template>
  <aside class="skin-list config-entity-list">
    <header class="skin-list-header config-entity-list-header">
      <h3>舰船皮肤列表</h3>
    </header>
    <ul :ref="setMediaRoot" class="skin-list-items config-entity-list-items">
      <li v-if="skins.length === 0" class="skin-list-empty config-entity-list-empty">未找到 data/hulls/skins 下的 .skin 文件。</li>
      <li
        v-for="skin in skins"
        :key="skin.skinHullId"
        :ref="mediaRef(skin.skinHullId, props.skinSpriteRefs[skin.skinHullId])"
        class="skin-list-item config-entity-list-item"
        :class="{ active: skin.skinHullId === selectedId }"
        @click="emit('select', skin.skinHullId)"
      >
        <span class="skin-list-preview config-entity-thumb">
          <img v-if="mediaSrc(props.skinSpriteRefs[skin.skinHullId])" :src="mediaSrc(props.skinSpriteRefs[skin.skinHullId])" alt="" />
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
      <n-button size="small" block :loading="openingCreateDialog" @click="openCreateDialog">新建舰船皮肤</n-button>
    </footer>

    <n-modal
      v-model:show="showCreateDialog"
      preset="dialog"
      title="新建舰船皮肤"
      positive-text="创建"
      negative-text="取消"
      @positive-click="submitCreateSkin"
    >
      <div class="variant-dialog-fields">
        <n-input v-if="settings.isPlainEditMode" v-model:value="newBaseHullId" placeholder="baseHullId" />
        <n-select v-else v-model:value="newBaseHullId" :options="props.hullOptions" filterable tag placeholder="baseHullId" />
        <n-input v-model:value="newSkinHullId" placeholder="skinHullId" />
      </div>
    </n-modal>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import type { ResourceRef, SkinFile } from '@/shared/types';
import type { SelectOption } from '@/domain/schema/schema-options';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useVisibleResourceMedia } from '@/app/composables/use-visible-resource-media';

const props = defineProps<{
  selectedId: string | null;
  skins: SkinFile[];
  skinSpriteRefs: Record<string, ResourceRef | null>;
  hullOptions: SelectOption[];
  loadHullOptions: () => Promise<void>;
  modRoot: string | null;
  sessionId: string | null;
  listLoadStartedAt: number;
  createSkin: (sessionId: string, modRoot: string, baseHullId: string, skinHullId: string) => Promise<boolean>;
  deleteSkin: (sessionId: string, modRoot: string, skin: Pick<SkinFile, 'relPath' | 'skinHullId'>) => Promise<boolean>;
}>();
const emit = defineEmits<{ select: [skinHullId: string | null] }>();

const settings = useSettingsStore();
const feedback = useAppFeedback();
const { mediaRef, mediaSrc, recordListFirstFrame, setMediaRoot } = useVisibleResourceMedia({
  sessionId: () => props.sessionId,
  surface: 'config-skin-list',
  failureLabel: '读取舰船皮肤缩略图失败',
});

const showCreateDialog = ref(false);
const openingCreateDialog = ref(false);
const newBaseHullId = ref('');
const newSkinHullId = ref('');
const createModRoot = ref<string | null>(null);
const createSessionId = ref<string | null>(null);

const skins = computed(() => [...props.skins].sort(compareSkins));

async function openCreateDialog() {
  createModRoot.value = props.modRoot;
  createSessionId.value = props.sessionId;
  if (!createModRoot.value || !createSessionId.value) return;
  openingCreateDialog.value = true;
  try {
    await props.loadHullOptions();
    if (props.modRoot !== createModRoot.value || props.sessionId !== createSessionId.value) return;
    showCreateDialog.value = true;
  } finally {
    openingCreateDialog.value = false;
  }
}

async function submitCreateSkin() {
  const targetModRoot = createModRoot.value;
  const targetSessionId = createSessionId.value;
  if (!targetModRoot || !targetSessionId) return false;
  const created = await props.createSkin(targetSessionId, targetModRoot, newBaseHullId.value.trim(), newSkinHullId.value.trim());
  if (!created) {
    return false;
  }
  const skinHullId = newSkinHullId.value.trim();
  showCreateDialog.value = false;
  newBaseHullId.value = '';
  newSkinHullId.value = '';
  if (props.modRoot === targetModRoot && props.sessionId === targetSessionId) emit('select', skinHullId);
  return true;
}

function confirmDeleteSkin(skin: SkinFile) {
  const deleteModRoot = props.modRoot;
  const deleteSessionId = props.sessionId;
  if (!deleteModRoot || !deleteSessionId) return;
  const deleteTarget = { relPath: skin.relPath, skinHullId: skin.skinHullId };
  feedback.confirmDanger({
    title: '删除舰船皮肤',
    content: `确定要删除舰船皮肤 "${deleteTarget.skinHullId}" 吗？`,
    actionText: '删除',
    onConfirm: async () => {
      await props.deleteSkin(deleteSessionId, deleteModRoot, deleteTarget);
    },
  });
}

function compareSkins(a: SkinFile, b: SkinFile): number {
  return a.baseHullId.localeCompare(b.baseHullId) || a.skinHullId.localeCompare(b.skinHullId);
}

watch(
  skins,
  (items) => {
    if (items.length === 0) {
      emit('select', null);
      return;
    }
    if (!items.some((skin) => skin.skinHullId === props.selectedId)) {
      emit('select', items[0].skinHullId);
    }
  },
  { immediate: true },
);

watch(
  () => props.skins,
  (items) => void recordListFirstFrame(props.listLoadStartedAt, items.length),
);
</script>
