import { ref, watch } from 'vue';
import { createSkinWithFileHistory, deleteSkinWithFileHistory, saveSkinWithFileHistory } from '@/orchestrators/config-save.orchestrator';
import { isSafeEntityFileStem } from '@/domain/config/config-entities';
import { listSkinEntities, queryHullReferenceOptions, querySkinPreviewSprites } from '@/services/config-entity.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { RowData, SkinFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-registry';

export function useConfigSkinViewModel() {
  const selectedSkinId = ref('');
  const skins = ref<SkinFile[]>([]);
  const skinSprites = ref<Record<string, string>>({});
  const hullOptions = ref<SelectOption[]>([]);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();

  async function loadSkins() {
    const sessionId = project.activeSessionId;
    if (!sessionId) {
      skins.value = [];
      selectedSkinId.value = '';
      return;
    }
    skins.value = await listSkinEntities(sessionId);
    await loadSkinSprites();
    if (selectedSkinId.value && !skins.value.some((skin) => skin.skinHullId === selectedSkinId.value)) {
      selectedSkinId.value = '';
    }
  }

  async function loadSkinSprites() {
    const sessionId = project.activeSessionId;
    if (!sessionId || skins.value.length === 0) {
      skinSprites.value = {};
      return;
    }
    try {
      skinSprites.value = await querySkinPreviewSprites(
        sessionId,
        skins.value.map((skin) => skin.skinHullId),
      );
    } catch (error) {
      feedback.error(error, '读取舰船皮肤缩略图失败');
    }
  }

  async function loadHullOptions() {
    const sessionId = project.activeSessionId;
    if (!sessionId || settings.isPlainEditMode) {
      hullOptions.value = [];
      return;
    }
    try {
      hullOptions.value = await queryHullReferenceOptions(sessionId);
    } catch (error) {
      feedback.error(error, '读取舰船引用失败');
    }
  }

  async function createSkin(baseHullId: string, skinHullId: string): Promise<boolean> {
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return false;
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
      await createSkinWithFileHistory(modRoot, baseHullId, skinHullId);
      await loadSkins();
      selectedSkinId.value = skinHullId;
      feedback.success(`舰船皮肤 "${skinHullId}" 已创建`);
      return true;
    } catch (error) {
      feedback.error(error, '创建舰船皮肤失败');
      return false;
    }
  }

  async function deleteSkin(skin: SkinFile): Promise<boolean> {
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return false;
    try {
      await deleteSkinWithFileHistory(modRoot, skin.relPath, skin.skinHullId);
      await loadSkins();
      if (selectedSkinId.value === skin.skinHullId) {
        selectedSkinId.value = skins.value[0]?.skinHullId ?? '';
      }
      feedback.success(`舰船皮肤 "${skin.skinHullId}" 已删除`);
      return true;
    } catch (error) {
      feedback.error(error, '删除舰船皮肤失败');
      return false;
    }
  }

  async function saveSkin(current: SkinFile, data: RowData): Promise<SkinFile | null> {
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return null;
    const nextSkinHullId = stringField(data, 'skinHullId');
    const nextBaseHullId = stringField(data, 'baseHullId');
    if (!nextSkinHullId || !nextBaseHullId) {
      feedback.warning('skinHullId 和 baseHullId 不能为空');
      return null;
    }
    if (!isSafeEntityFileStem(nextSkinHullId)) {
      feedback.error('skinHullId 不能包含路径分隔符或 ..');
      return null;
    }
    if (skins.value.some((skin) => skin.skinHullId === nextSkinHullId && skin.skinHullId !== current.skinHullId)) {
      feedback.warning(`舰船皮肤 "${nextSkinHullId}" 已存在`);
      return null;
    }
    const renamed = nextSkinHullId !== current.skinHullId;
    const result = await saveSkinWithFileHistory(
      modRoot,
      nextSkinHullId,
      data,
      renamed ? current.skinHullId : null,
      renamed ? current.relPath : null,
    );
    await loadSkins();
    selectedSkinId.value = result.skinFile.skinHullId;
    feedback.success(`舰船皮肤 "${result.skinFile.skinHullId}" 已保存`);
    return result.skinFile;
  }

  function onSaved(skinHullId: string) {
    selectedSkinId.value = skinHullId;
  }

  watch(() => project.activeSessionId, loadSkins, { immediate: true });
  watch([() => project.activeSessionId, () => settings.isPlainEditMode], () => void loadHullOptions(), { immediate: true });

  return { selectedSkinId, skins, skinSprites, hullOptions, createSkin, deleteSkin, loadSkins, onSaved, saveSkin };
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}
