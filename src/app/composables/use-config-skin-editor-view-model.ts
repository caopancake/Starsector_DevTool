import { computed, watch, type Ref } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useConfigEditorDraftSession } from '@/app/composables/use-config-editor-draft-session';
import type { RowData, SkinFile } from '@/shared/types';

export function useConfigSkinEditorViewModel(params: {
  dataRevision: Ref<number>;
  modRoot: Ref<string | null>;
  onSaved: (skinHullId: string | null) => void;
  saveSkin: (sessionId: string, modRoot: string, current: SkinFile, data: RowData) => Promise<SkinFile | null>;
  sessionId: Ref<string | null>;
  skinHullId: Ref<string>;
  skins: Ref<SkinFile[]>;
}) {
  const feedback = useAppFeedback();
  const selectedSkin = computed(() => params.skins.value.find((skin) => skin.skinHullId === params.skinHullId.value) ?? null);
  const draftSession = useConfigEditorDraftSession<RowData, string, SkinFile | null, SkinFile>({
    emptyValue: {},
    load: (skinHullId) => {
      const skin = params.skins.value.find((candidate) => candidate.skinHullId === skinHullId) ?? null;
      return { meta: skin, value: skin ? skin.data : {} };
    },
    save: async (_skinHullId, data) => {
      const current = selectedSkin.value;
      const saveModRoot = params.modRoot.value;
      const saveSessionId = params.sessionId.value;
      if (!current || !saveModRoot || !saveSessionId) return;
      const saved = await params.saveSkin(saveSessionId, saveModRoot, current, data);
      if (params.modRoot.value !== saveModRoot || params.sessionId.value !== saveSessionId || !saved) return;
      return { meta: saved, value: saved.data };
    },
    targetKey: (skinHullId) => skinHullId,
  });

  watch(
    () => [params.skinHullId.value, params.dataRevision.value] as const,
    ([skinHullId]) => {
      const skin = selectedSkin.value;
      const data = skin ? skin.data : {};
      if (draftSession.currentTargetKey.value !== skinHullId) void draftSession.loadTarget(skinHullId);
      else draftSession.applyExternalForTarget(skinHullId, data);
    },
    { immediate: true },
  );

  async function save() {
    try {
      const saved = await draftSession.saveDraft();
      if (saved?.meta) params.onSaved(saved.meta.skinHullId);
    } catch (error) {
      feedback.error(error, '保存舰船皮肤失败');
    }
  }

  return {
    draftData: draftSession.draftValue,
    externalUpdateNotice: draftSession.externalUpdateNotice,
    hasPendingExternalData: draftSession.hasPendingExternalValue,
    loadPendingExternalData: draftSession.loadPendingExternal,
    save,
    saving: draftSession.saving,
    selectedSkin,
  };
}
