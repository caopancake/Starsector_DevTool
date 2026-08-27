import { computed, onUnmounted, ref, watch } from 'vue';
import { createVariantAction, deleteVariantAction, saveVariantAction } from '@/orchestrators/config-save.orchestrator';
import {
  configEntityIdInvalidMessage,
  configEntityRenameContext,
  hasConfigEntityIdConflict,
  isConfigEntityId,
  trimmedConfigStringField,
} from '@/domain/config/config-entities';
import { listVariantRecords } from '@/services/config-entity.service';
import { queryHullPreviewMetadata, queryHullReferenceOptions } from '@/services/config-resource.service';
import { useProjectStore } from '@/stores/project.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ResourceRef, RowData, VariantFile } from '@/shared/types';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import type { SelectOption } from '@/domain/schema/schema-options';
import { hasEntityInvalidation, hasQueryInvalidation, subscribeQueryInvalidations } from '@/services/query-cache.service';

export function useConfigVariantViewModel() {
  const selectedVariantId = ref<string | null>(null);
  const variants = ref<VariantFile[]>([]);
  const variantHullNames = ref<Record<string, string>>({});
  const variantSpriteRefs = ref<Record<string, ResourceRef | null>>({});
  const hullOptions = ref<SelectOption[]>([]);
  const variantDataRevision = ref(0);
  const listLoadStartedAt = ref(0);
  const project = useProjectStore();
  const settings = useSettingsStore();
  const feedback = useAppFeedback();
  const modRoot = computed(() => project.activeManifest?.modRoot ?? null);
  const sessionId = computed(() => project.activeManifest?.sessionId ?? null);
  let variantsRequestId = 0;
  let variantHullReferencesRequestId = 0;
  let hullOptionsRequestId = 0;
  const hullOptionsLoaded = ref(false);

  async function loadVariants() {
    const requestId = ++variantsRequestId;
    const sessionId = project.activeSessionId;
    if (!sessionId) {
      variants.value = [];
      variantHullNames.value = {};
      variantSpriteRefs.value = {};
      selectedVariantId.value = null;
      variantDataRevision.value += 1;
      return;
    }
    listLoadStartedAt.value = performance.now();
    const selectedId = selectedVariantId.value;
    const previousSelected = selectedId ? variants.value.find((variant) => variant.variantId === selectedId) : null;
    try {
      const records = await listVariantRecords(sessionId);
      if (requestId !== variantsRequestId || sessionId !== project.activeSessionId) return;
      variants.value = records.map((record) => record.variant);
      variantSpriteRefs.value = Object.fromEntries(records.map((record) => [record.variant.variantId, record.spriteRef]));
      await loadVariantHullReferences();
      const nextSelected = selectedId ? variants.value.find((variant) => variant.variantId === selectedId) : null;
      if (selectedEntityDataChanged(previousSelected, nextSelected)) variantDataRevision.value += 1;
      if (selectedVariantId.value && !variants.value.some((variant) => variant.variantId === selectedVariantId.value)) {
        selectedVariantId.value = null;
      }
    } catch (error) {
      if (requestId !== variantsRequestId || sessionId !== project.activeSessionId) return;
      feedback.error(error, '加载装配失败');
    }
  }

  async function loadVariantHullReferences() {
    const requestId = ++variantHullReferencesRequestId;
    const sessionId = project.activeSessionId;
    const sourceVariants = variants.value;
    if (!sessionId || variants.value.length === 0) {
      variantHullNames.value = {};
      return;
    }
    try {
      const hullNames = await queryHullPreviewMetadata(
        sessionId,
        sourceVariants.map((variant) => variant.hullId),
      );
      if (requestId !== variantHullReferencesRequestId || sessionId !== project.activeSessionId || sourceVariants !== variants.value)
        return;
      variantHullNames.value = hullNames;
    } catch (error) {
      feedback.error(error, '读取装配缩略图失败');
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

  async function createVariant(createSessionId: string, createModRoot: string, hullId: string, variantId: string): Promise<boolean> {
    if (!hullId || !variantId) {
      feedback.warning('hullId 和 variantId 不能为空');
      return false;
    }
    if (!isConfigEntityId(variantId)) {
      feedback.error(configEntityIdInvalidMessage('variantId'));
      return false;
    }
    if (hasConfigEntityIdConflict(variants.value, variantId, null, (variant) => variant.variantId)) {
      feedback.warning(`装配 "${variantId}" 已存在`);
      return false;
    }
    try {
      await createVariantAction(createSessionId, createModRoot, hullId, variantId);
      if (project.activeManifest?.modRoot !== createModRoot || project.activeManifest.sessionId !== createSessionId) return true;
      await loadVariants();
      selectedVariantId.value = variantId;
      feedback.success(`装配 "${variantId}" 已创建`);
      return true;
    } catch (error) {
      feedback.error(error, '创建装配失败');
      return false;
    }
  }

  async function deleteVariant(
    deleteSessionId: string,
    deleteModRoot: string,
    variant: Pick<VariantFile, 'relPath' | 'variantId'>,
  ): Promise<boolean> {
    try {
      await deleteVariantAction(deleteSessionId, deleteModRoot, variant.relPath, variant.variantId);
      if (project.activeManifest?.modRoot !== deleteModRoot || project.activeManifest.sessionId !== deleteSessionId) return true;
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

  async function saveVariant(saveSessionId: string, saveModRoot: string, current: VariantFile, data: RowData): Promise<VariantFile | null> {
    const manifest = project.activeManifest;
    if (!manifest || manifest.modRoot !== saveModRoot || manifest.sessionId !== saveSessionId) return null;
    const nextVariantId = trimmedConfigStringField(data, 'variantId');
    const nextHullId = trimmedConfigStringField(data, 'hullId');
    if (!nextVariantId || !nextHullId) {
      feedback.warning('variantId 和 hullId 不能为空');
      return null;
    }
    if (!isConfigEntityId(nextVariantId)) {
      feedback.error(configEntityIdInvalidMessage('variantId'));
      return null;
    }
    if (hasConfigEntityIdConflict(variants.value, nextVariantId, current.variantId, (variant) => variant.variantId)) {
      feedback.warning(`装配 "${nextVariantId}" 已存在`);
      return null;
    }
    const renameContext = configEntityRenameContext(current.variantId, nextVariantId);
    const variant = await saveVariantAction(saveSessionId, saveModRoot, nextVariantId, data, renameContext.previousId);
    if (project.activeManifest?.modRoot !== saveModRoot || project.activeManifest.sessionId !== saveSessionId) return variant;
    await loadVariants();
    selectedVariantId.value = variant.variantId;
    feedback.success(`装配 "${variant.variantId}" 已保存`);
    return variant;
  }

  function onSaved(variantId: string | null) {
    selectedVariantId.value = variantId;
  }

  watch(() => project.activeSessionId, loadVariants, { immediate: true });
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
    const variantsChanged = hasEntityInvalidation(event, 'entity-list', 'variant');
    const hullReferenceQueryChanged = hasQueryInvalidation(event, 'hull-references');
    if (variantsChanged) void loadVariants();
    if (hullReferenceQueryChanged) {
      void loadVariantHullReferences();
      if (hullOptionsLoaded.value) void loadHullOptions();
    }
  });
  onUnmounted(() => {
    stopQueryInvalidation();
  });

  return {
    selectedVariantId,
    modRoot,
    sessionId,
    variants,
    variantHullNames,
    variantSpriteRefs,
    hullOptions,
    loadHullOptions,
    variantDataRevision,
    listLoadStartedAt,
    createVariant,
    deleteVariant,
    loadVariants,
    onSaved,
    saveVariant,
  };
}

function selectedEntityDataChanged(previous: VariantFile | null | undefined, next: VariantFile | null | undefined): boolean {
  if (!previous && !next) return false;
  if (!previous || !next) return true;
  return JSON.stringify(previous.data) !== JSON.stringify(next.data);
}
