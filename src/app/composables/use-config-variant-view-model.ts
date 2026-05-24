import { ref, watch } from 'vue';
import {
  createVariantWithFileHistory,
  deleteVariantWithFileHistory,
  saveVariantWithFileHistory,
} from '@/orchestrators/config-save.orchestrator';
import { isSafeEntityFileStem } from '@/domain/config/config-entities';
import { listVariantEntities, queryHullPreviewSprites, queryHullReferenceOptions } from '@/services/config-entity.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { RowData, VariantFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-registry';

export function useConfigVariantViewModel() {
  const selectedVariantId = ref('');
  const variants = ref<VariantFile[]>([]);
  const variantSprites = ref<Record<string, string>>({});
  const hullOptions = ref<SelectOption[]>([]);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();

  async function loadVariants() {
    const sessionId = project.activeSessionId;
    if (!sessionId) {
      variants.value = [];
      selectedVariantId.value = '';
      return;
    }
    variants.value = await listVariantEntities(sessionId);
    await loadVariantSprites();
    if (selectedVariantId.value && !variants.value.some((variant) => variant.variantId === selectedVariantId.value)) {
      selectedVariantId.value = '';
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
      hullOptions.value = await queryHullReferenceOptions(sessionId);
    } catch (error) {
      feedback.error(error, '读取舰船引用失败');
    }
  }

  async function createVariant(hullId: string, variantId: string): Promise<boolean> {
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return false;
    if (!hullId || !variantId) {
      feedback.warning('hullId 和 variantId 不能为空');
      return false;
    }
    if (!isSafeEntityFileStem(variantId)) {
      feedback.error('variantId 不能包含路径分隔符或 ..');
      return false;
    }
    if (variants.value.some((variant) => variant.variantId === variantId)) {
      feedback.warning(`装配 "${variantId}" 已存在`);
      return false;
    }
    try {
      await createVariantWithFileHistory(modRoot, hullId, variantId);
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
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return false;
    try {
      await deleteVariantWithFileHistory(modRoot, variant.relPath, variant.variantId);
      await loadVariants();
      if (selectedVariantId.value === variant.variantId) {
        selectedVariantId.value = variants.value[0]?.variantId ?? '';
      }
      feedback.success(`装配 "${variant.variantId}" 已删除`);
      return true;
    } catch (error) {
      feedback.error(error, '删除装配失败');
      return false;
    }
  }

  async function saveVariant(current: VariantFile, data: RowData): Promise<VariantFile | null> {
    const modRoot = project.activeManifest?.modRoot ?? '';
    if (!modRoot) return null;
    const nextVariantId = stringField(data, 'variantId');
    const nextHullId = stringField(data, 'hullId');
    if (!nextVariantId || !nextHullId) {
      feedback.warning('variantId 和 hullId 不能为空');
      return null;
    }
    if (!isSafeEntityFileStem(nextVariantId)) {
      feedback.error('variantId 不能包含路径分隔符或 ..');
      return null;
    }
    if (variants.value.some((variant) => variant.variantId === nextVariantId && variant.variantId !== current.variantId)) {
      feedback.warning(`装配 "${nextVariantId}" 已存在`);
      return null;
    }
    const renamed = nextVariantId !== current.variantId;
    const result = await saveVariantWithFileHistory(
      modRoot,
      nextVariantId,
      data,
      renamed ? current.variantId : null,
      renamed ? current.relPath : null,
    );
    await loadVariants();
    selectedVariantId.value = result.variantFile.variantId;
    feedback.success(`装配 "${result.variantFile.variantId}" 已保存`);
    return result.variantFile;
  }

  function onSaved(variantId: string) {
    selectedVariantId.value = variantId;
  }

  watch(() => project.activeSessionId, loadVariants, { immediate: true });
  watch([() => project.activeSessionId, () => settings.isPlainEditMode], () => void loadHullOptions(), { immediate: true });

  return { selectedVariantId, variants, variantSprites, hullOptions, createVariant, deleteVariant, loadVariants, onSaved, saveVariant };
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}
