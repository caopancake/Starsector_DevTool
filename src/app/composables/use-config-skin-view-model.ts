import { computed, onUnmounted, ref, watch } from 'vue';
import { createSkinAction, deleteSkinAction, saveSkinAction } from '@/orchestrators/config-save.orchestrator';
import {
  configEntityRenameContext,
  hasConfigEntityIdConflict,
  isConfigEntityId,
  trimmedConfigStringField,
} from '@/domain/config/config-entities';
import { listSkinEntities } from '@/services/config-entity.service';
import { queryHullReferenceOptions, querySkinPreviewResources } from '@/services/config-resource.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ResourceRef, RowData, SkinFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-options';
import { hasEntityInvalidation, hasQueryInvalidation, subscribeQueryInvalidations } from '@/services/query-cache.service';
import { hasResourceInvalidation, subscribeResourceInvalidations } from '@/services/resource-cache.service';

export function useConfigSkinViewModel() {
  const selectedSkinId = ref<string | null>(null);
  const skins = ref<SkinFile[]>([]);
  const skinSprites = ref<Record<string, string>>({});
  const skinSpriteResourceRefs = ref<ResourceRef[]>([]);
  const hullOptions = ref<SelectOption[]>([]);
  const skinDataRevision = ref(0);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();
  const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
  const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
  let skinsRequestId = 0;
  let skinSpritesRequestId = 0;
  let hullOptionsRequestId = 0;
  const hullOptionsLoaded = ref(false);

  async function loadSkins() {
    const requestId = ++skinsRequestId;
    const sessionId = project.activeSessionId;
    if (!sessionId) {
      skins.value = [];
      skinSprites.value = {};
      skinSpriteResourceRefs.value = [];
      selectedSkinId.value = null;
      skinDataRevision.value += 1;
      return;
    }
    const selectedId = selectedSkinId.value;
    const previousSelected = selectedId ? skins.value.find((skin) => skin.skinHullId === selectedId) : null;
    const loadedSkins = await listSkinEntities(sessionId);
    if (requestId !== skinsRequestId || sessionId !== project.activeSessionId) return;
    skins.value = loadedSkins;
    await loadSkinSprites();
    const nextSelected = selectedId ? skins.value.find((skin) => skin.skinHullId === selectedId) : null;
    if (selectedEntityDataChanged(previousSelected, nextSelected)) skinDataRevision.value += 1;
    if (selectedSkinId.value && !skins.value.some((skin) => skin.skinHullId === selectedSkinId.value)) {
      selectedSkinId.value = null;
    }
  }

  async function loadSkinSprites() {
    const requestId = ++skinSpritesRequestId;
    const sessionId = project.activeSessionId;
    const sourceSkins = skins.value;
    if (!sessionId || skins.value.length === 0) {
      skinSprites.value = {};
      skinSpriteResourceRefs.value = [];
      return;
    }
    try {
      const resources = await querySkinPreviewResources(
        sessionId,
        sourceSkins.map((skin) => skin.skinHullId),
      );
      if (requestId !== skinSpritesRequestId || sessionId !== project.activeSessionId || sourceSkins !== skins.value) return;
      skinSpriteResourceRefs.value = resources.resourceRefs;
      skinSprites.value = resources.sprites;
    } catch (error) {
      feedback.error(error, '读取舰船皮肤缩略图失败');
    }
  }

  async function loadHullOptions() {
    const requestId = ++hullOptionsRequestId;
    const sessionId = project.activeSessionId;
    if (!sessionId || settings.isPlainEditMode) {
      hullOptions.value = [];
      hullOptionsLoaded.value = false;
      return;
    }
    try {
      const options = await queryHullReferenceOptions(sessionId, []);
      if (requestId !== hullOptionsRequestId || sessionId !== project.activeSessionId) return;
      hullOptions.value = options;
      hullOptionsLoaded.value = true;
    } catch (error) {
      feedback.error(error, '读取舰船引用失败');
    }
  }

  async function createSkin(createSessionId: string, createModRoot: string, baseHullId: string, skinHullId: string): Promise<boolean> {
    if (!baseHullId || !skinHullId) {
      feedback.warning('baseHullId 和 skinHullId 不能为空');
      return false;
    }
    if (!isConfigEntityId(skinHullId)) {
      feedback.error('skinHullId 不能包含路径分隔符或 ..');
      return false;
    }
    if (hasConfigEntityIdConflict(skins.value, skinHullId, null, (skin) => skin.skinHullId)) {
      feedback.warning(`舰船皮肤 "${skinHullId}" 已存在`);
      return false;
    }
    try {
      await createSkinAction(createSessionId, createModRoot, baseHullId, skinHullId);
      if (project.activeManifest?.modRoot !== createModRoot || project.activeManifest.sessionId !== createSessionId) return true;
      await loadSkins();
      selectedSkinId.value = skinHullId;
      feedback.success(`舰船皮肤 "${skinHullId}" 已创建`);
      return true;
    } catch (error) {
      feedback.error(error, '创建舰船皮肤失败');
      return false;
    }
  }

  async function deleteSkin(
    deleteSessionId: string,
    deleteModRoot: string,
    skin: Pick<SkinFile, 'relPath' | 'skinHullId'>,
  ): Promise<boolean> {
    try {
      await deleteSkinAction(deleteSessionId, deleteModRoot, skin.relPath, skin.skinHullId);
      if (project.activeManifest?.modRoot !== deleteModRoot || project.activeManifest.sessionId !== deleteSessionId) return true;
      await loadSkins();
      if (selectedSkinId.value === skin.skinHullId) {
        selectedSkinId.value = skins.value[0]?.skinHullId ?? null;
      }
      feedback.success(`舰船皮肤 "${skin.skinHullId}" 已删除`);
      return true;
    } catch (error) {
      feedback.error(error, '删除舰船皮肤失败');
      return false;
    }
  }

  async function saveSkin(saveSessionId: string, saveModRoot: string, current: SkinFile, data: RowData): Promise<SkinFile | null> {
    const manifest = project.activeManifest;
    if (!manifest || manifest.modRoot !== saveModRoot || manifest.sessionId !== saveSessionId) return null;
    const nextSkinHullId = trimmedConfigStringField(data, 'skinHullId');
    const nextBaseHullId = trimmedConfigStringField(data, 'baseHullId');
    if (!nextSkinHullId || !nextBaseHullId) {
      feedback.warning('skinHullId 和 baseHullId 不能为空');
      return null;
    }
    if (!isConfigEntityId(nextSkinHullId)) {
      feedback.error('skinHullId 不能包含路径分隔符或 ..');
      return null;
    }
    if (hasConfigEntityIdConflict(skins.value, nextSkinHullId, current.skinHullId, (skin) => skin.skinHullId)) {
      feedback.warning(`舰船皮肤 "${nextSkinHullId}" 已存在`);
      return null;
    }
    const renameContext = configEntityRenameContext(current.skinHullId, nextSkinHullId);
    const skin = await saveSkinAction(saveSessionId, saveModRoot, nextSkinHullId, data, renameContext.previousId);
    if (project.activeManifest?.modRoot !== saveModRoot || project.activeManifest.sessionId !== saveSessionId) return skin;
    await loadSkins();
    selectedSkinId.value = skin.skinHullId;
    feedback.success(`舰船皮肤 "${skin.skinHullId}" 已保存`);
    return skin;
  }

  function onSaved(skinHullId: string | null) {
    selectedSkinId.value = skinHullId;
  }

  watch(() => project.activeSessionId, loadSkins, { immediate: true });
  watch(
    () => settings.isPlainEditMode,
    () => {
      if (settings.isPlainEditMode) {
        hullOptions.value = [];
        hullOptionsLoaded.value = false;
      }
    },
  );
  const stopQueryInvalidation = subscribeQueryInvalidations((event) => {
    if (event.sessionId !== project.activeSessionId) return;
    const skinsChanged = hasEntityInvalidation(event, 'entity-list', 'skin');
    const hullReferenceQueryChanged = hasQueryInvalidation(event, 'hull-references');
    if (skinsChanged) void loadSkins();
    if (hullReferenceQueryChanged) {
      void loadSkinSprites();
      if (hullOptionsLoaded.value) void loadHullOptions();
    }
  });
  const stopResourceInvalidation = subscribeResourceInvalidations((event) => {
    if (event.sessionId !== project.activeSessionId) return;
    if (!hasResourceInvalidation(event, skinSpriteResourceRefs.value)) return;
    void loadSkinSprites();
  });
  onUnmounted(() => {
    stopQueryInvalidation();
    stopResourceInvalidation();
  });

  return {
    selectedSkinId,
    modRoot,
    sessionId,
    skins,
    skinSprites,
    hullOptions,
    loadHullOptions,
    skinDataRevision,
    createSkin,
    deleteSkin,
    loadSkins,
    onSaved,
    saveSkin,
  };
}

function selectedEntityDataChanged(previous: SkinFile | null | undefined, next: SkinFile | null | undefined): boolean {
  if (!previous && !next) return false;
  if (!previous || !next) return true;
  return JSON.stringify(previous.data) !== JSON.stringify(next.data);
}
