import { ref, watch } from 'vue';
import { createSkinAction, deleteSkinAction, saveSkinAction } from '@/orchestrators/config-save.orchestrator';
import {
  configEntityRenameContext,
  hasConfigEntityIdConflict,
  isConfigEntityId,
  trimmedConfigStringField,
} from '@/domain/config/config-entities';
import { listSkinEntities } from '@/services/config-entity.service';
import { queryHullReferenceOptions, querySkinPreviewSprites } from '@/services/config-resource.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { RowData, SkinFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-registry';

export function useConfigSkinViewModel() {
  const selectedSkinId = ref<string | null>(null);
  const skins = ref<SkinFile[]>([]);
  const skinSprites = ref<Record<string, string>>({});
  const hullOptions = ref<SelectOption[]>([]);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();

  async function loadSkins() {
    const sessionId = project.activeSessionId;
    const manifest = project.activeManifest;
    if (!sessionId || !manifest) {
      skins.value = [];
      selectedSkinId.value = null;
      return;
    }
    skins.value = await listSkinEntities(sessionId);
    project.updateEntitySummary(manifest.modRoot, 'skins', skins.value.length);
    await loadSkinSprites();
    if (selectedSkinId.value && !skins.value.some((skin) => skin.skinHullId === selectedSkinId.value)) {
      selectedSkinId.value = null;
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
      hullOptions.value = await queryHullReferenceOptions(sessionId, []);
    } catch (error) {
      feedback.error(error, '读取舰船引用失败');
    }
  }

  async function createSkin(baseHullId: string, skinHullId: string): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
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
      await createSkinAction(manifest.modRoot, baseHullId, skinHullId);
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
    const manifest = project.activeManifest;
    if (!manifest) return false;
    try {
      await deleteSkinAction(manifest.modRoot, skin.relPath, skin.skinHullId);
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

  async function saveSkin(current: SkinFile, data: RowData): Promise<SkinFile | null> {
    const manifest = project.activeManifest;
    if (!manifest) return null;
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
    const renameContext = configEntityRenameContext(current.skinHullId, current.relPath, nextSkinHullId);
    const skin = await saveSkinAction(manifest.modRoot, nextSkinHullId, data, renameContext.previousId, renameContext.previousRelPath);
    await loadSkins();
    selectedSkinId.value = skin.skinHullId;
    feedback.success(`舰船皮肤 "${skin.skinHullId}" 已保存`);
    return skin;
  }

  function onSaved(skinHullId: string | null) {
    selectedSkinId.value = skinHullId;
  }

  watch(() => project.activeSessionId, loadSkins, { immediate: true });
  watch([() => project.activeSessionId, () => settings.isPlainEditMode], () => void loadHullOptions(), { immediate: true });

  return { selectedSkinId, skins, skinSprites, hullOptions, createSkin, deleteSkin, loadSkins, onSaved, saveSkin };
}
