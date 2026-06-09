import { computed, watch, type Ref } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useConfigEditorDraftSession } from '@/app/composables/use-config-editor-draft-session';
import type { RowData, VariantFile } from '@/shared/types';

export function useConfigVariantEditorViewModel(params: {
  dataRevision: Ref<number>;
  modRoot: Ref<string | null>;
  onSaved: (variantId: string | null) => void;
  saveVariant: (sessionId: string, modRoot: string, current: VariantFile, data: RowData) => Promise<VariantFile | null>;
  sessionId: Ref<string | null>;
  variantId: Ref<string>;
  variants: Ref<VariantFile[]>;
}) {
  const feedback = useAppFeedback();
  const selectedVariant = computed(() => params.variants.value.find((variant) => variant.variantId === params.variantId.value) ?? null);
  const draftSession = useConfigEditorDraftSession<RowData, string, VariantFile | null, VariantFile>({
    emptyValue: {},
    load: (variantId) => {
      const variant = params.variants.value.find((candidate) => candidate.variantId === variantId) ?? null;
      return { meta: variant, value: variant ? variant.data : {} };
    },
    save: async (_variantId, data) => {
      const current = selectedVariant.value;
      const saveModRoot = params.modRoot.value;
      const saveSessionId = params.sessionId.value;
      if (!current || !saveModRoot || !saveSessionId) return;
      const saved = await params.saveVariant(saveSessionId, saveModRoot, current, data);
      if (params.modRoot.value !== saveModRoot || params.sessionId.value !== saveSessionId || !saved) return;
      return { meta: saved, value: saved.data };
    },
    targetKey: (variantId) => variantId,
  });

  watch(
    () => [params.variantId.value, params.dataRevision.value] as const,
    ([variantId]) => {
      const variant = selectedVariant.value;
      const data = variant ? variant.data : {};
      if (draftSession.currentTargetKey.value !== variantId) void draftSession.loadTarget(variantId);
      else draftSession.applyExternalForTarget(variantId, data);
    },
    { immediate: true },
  );

  async function save() {
    try {
      const saved = await draftSession.saveDraft();
      if (saved?.meta) params.onSaved(saved.meta.variantId);
    } catch (error) {
      feedback.error(error, '保存装配失败');
    }
  }

  return {
    draftData: draftSession.draftValue,
    externalUpdateNotice: draftSession.externalUpdateNotice,
    hasPendingExternalData: draftSession.hasPendingExternalValue,
    loadPendingExternalData: draftSession.loadPendingExternal,
    save,
    saving: draftSession.saving,
    selectedVariant,
  };
}
