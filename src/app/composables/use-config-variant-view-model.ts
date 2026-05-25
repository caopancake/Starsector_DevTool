import { ref, watch } from 'vue';
import { createVariantAction, deleteVariantAction, saveVariantAction } from '@/orchestrators/config-save.orchestrator';
import {
  configEntityRenameContext,
  hasConfigEntityIdConflict,
  isConfigEntityId,
  trimmedConfigStringField,
} from '@/domain/config/config-entities';
import { listVariantEntities } from '@/services/config-entity.service';
import { queryHullPreviewSprites, queryHullReferenceOptions } from '@/services/config-resource.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { RowData, VariantFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-registry';

export function useConfigVariantViewModel() {
  const selectedVariantId = ref<string | null>(null);
  const variants = ref<VariantFile[]>([]);
  const variantSprites = ref<Record<string, string>>({});
  const hullOptions = ref<SelectOption[]>([]);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();

  async function loadVariants() {
    const sessionId = project.activeSessionId;
    const manifest = project.activeManifest;
    if (!sessionId || !manifest) {
      variants.value = [];
      selectedVariantId.value = null;
      return;
    }
    variants.value = await listVariantEntities(sessionId);
    project.updateEntitySummary(manifest.modRoot, 'variants', variants.value.length);
    await loadVariantSprites();
    if (selectedVariantId.value && !variants.value.some((variant) => variant.variantId === selectedVariantId.value)) {
      selectedVariantId.value = null;
    }
  }

  async function loadVariantSprites() {
    const sessionId = project.activeSessionId;
    if (!sessionId || variants.value.length === 0) {
      variantSprites.value = {};
      return;
    }
    try {
      const spritesByHull = await queryHullPreviewSprites(
        sessionId,
        variants.value.map((variant) => variant.hullId),
      );
      variantSprites.value = Object.fromEntries(variants.value.map((variant) => [variant.variantId, spritesByHull[variant.hullId] ?? '']));
    } catch (error) {
      feedback.error(error, '读取装配缩略图失败');
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

  async function createVariant(hullId: string, variantId: string): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
    if (!hullId || !variantId) {
      feedback.warning('hullId 和 variantId 不能为空');
      return false;
    }
    if (!isConfigEntityId(variantId)) {
      feedback.error('variantId 不能包含路径分隔符或 ..');
      return false;
    }
    if (hasConfigEntityIdConflict(variants.value, variantId, null, (variant) => variant.variantId)) {
      feedback.warning(`装配 "${variantId}" 已存在`);
      return false;
    }
    try {
      await createVariantAction(manifest.modRoot, hullId, variantId);
      await loadVariants();
      selectedVariantId.value = variantId;
      feedback.success(`装配 "${variantId}" 已创建`);
      return true;
    } catch (error) {
      feedback.error(error, '创建装配失败');
      return false;
    }
  }

  async function deleteVariant(variant: VariantFile): Promise<boolean> {
    const manifest = project.activeManifest;
    if (!manifest) return false;
    try {
      await deleteVariantAction(manifest.modRoot, variant.relPath, variant.variantId);
      await loadVariants();
      if (selectedVariantId.value === variant.variantId) {
        selectedVariantId.value = variants.value[0]?.variantId ?? null;
      }
      feedback.success(`装配 "${variant.variantId}" 已删除`);
      return true;
    } catch (error) {
      feedback.error(error, '删除装配失败');
      return false;
    }
  }

  async function saveVariant(current: VariantFile, data: RowData): Promise<VariantFile | null> {
    const manifest = project.activeManifest;
    if (!manifest) return null;
    const nextVariantId = trimmedConfigStringField(data, 'variantId');
    const nextHullId = trimmedConfigStringField(data, 'hullId');
    if (!nextVariantId || !nextHullId) {
      feedback.warning('variantId 和 hullId 不能为空');
      return null;
    }
    if (!isConfigEntityId(nextVariantId)) {
      feedback.error('variantId 不能包含路径分隔符或 ..');
      return null;
    }
    if (hasConfigEntityIdConflict(variants.value, nextVariantId, current.variantId, (variant) => variant.variantId)) {
      feedback.warning(`装配 "${nextVariantId}" 已存在`);
      return null;
    }
    const renameContext = configEntityRenameContext(current.variantId, current.relPath, nextVariantId);
    const variant = await saveVariantAction(manifest.modRoot, nextVariantId, data, renameContext.previousId, renameContext.previousRelPath);
    await loadVariants();
    selectedVariantId.value = variant.variantId;
    feedback.success(`装配 "${variant.variantId}" 已保存`);
    return variant;
  }

  function onSaved(variantId: string | null) {
    selectedVariantId.value = variantId;
  }

  watch(() => project.activeSessionId, loadVariants, { immediate: true });
  watch([() => project.activeSessionId, () => settings.isPlainEditMode], () => void loadHullOptions(), { immediate: true });

  return { selectedVariantId, variants, variantSprites, hullOptions, createVariant, deleteVariant, loadVariants, onSaved, saveVariant };
}
