import { computed, watch, type Ref } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { useConfigEditorDraftSession } from '@/app/composables/config/use-config-editor-draft-session';
import type { ConfigEntityFamilyDefinition, ConfigFamilyFile } from '@/domain/config/config-entity-families';
import { familyFileId } from '@/domain/config/config-entity-families';
import type { RowData } from '@/shared/types';

export function useConfigFamilyEditorViewModel(params: {
  family: ConfigEntityFamilyDefinition;
  dataRevision: Ref<number>;
  modRoot: Ref<string | null>;
  onSaved: (id: string | null) => void;
  saveFile: (sessionId: string, modRoot: string, current: ConfigFamilyFile, data: RowData) => Promise<ConfigFamilyFile | null>;
  sessionId: Ref<string | null>;
  selectedId: Ref<string>;
  files: Ref<ConfigFamilyFile[]>;
}) {
  const feedback = useAppFeedback();
  const family = params.family;

  const selectedFile = computed(() => params.files.value.find((file) => familyFileId(family, file) === params.selectedId.value) ?? null);

  const draftSession = useConfigEditorDraftSession<RowData, string, ConfigFamilyFile | null, ConfigFamilyFile>({
    emptyValue: {},
    modRoot: params.modRoot,
    load: (id) => {
      const file = params.files.value.find((candidate) => familyFileId(family, candidate) === id) ?? null;
      return { meta: file, value: file ? file.data : {} };
    },
    save: async (_id, data) => {
      const current = selectedFile.value;
      const saveModRoot = params.modRoot.value;
      const saveSessionId = params.sessionId.value;
      if (!current || !saveModRoot || !saveSessionId) return;
      const saved = await params.saveFile(saveSessionId, saveModRoot, current, data);
      if (params.modRoot.value !== saveModRoot || params.sessionId.value !== saveSessionId || !saved) return;
      return { meta: saved, value: saved.data };
    },
    targetKey: (id) => id,
  });

  watch(
    () => [params.selectedId.value, params.dataRevision.value] as const,
    ([selectedId]) => {
      const file = selectedFile.value;
      const data = file ? file.data : {};
      if (draftSession.currentTargetKey.value !== selectedId) void loadFamilyEditorData(selectedId);
      else draftSession.applyExternalForTarget(selectedId, data);
    },
    { immediate: true },
  );

  async function loadFamilyEditorData(selectedId: string) {
    try {
      await draftSession.loadTarget(selectedId);
    } catch (error) {
      feedback.error(error, `加载${family.displayName}失败`);
    }
  }

  async function save() {
    try {
      const saved = await draftSession.saveDraft();
      if (saved?.meta) params.onSaved(familyFileId(family, saved.meta));
    } catch (error) {
      feedback.error(error, `保存${family.displayName}失败`);
    }
  }

  return {
    draftData: draftSession.draftValue,
    externalUpdateNotice: draftSession.externalUpdateNotice,
    hasPendingExternalData: draftSession.hasPendingExternalValue,
    loadPendingExternalData: draftSession.loadPendingExternal,
    save,
    saving: draftSession.saving,
    selectedFile,
  };
}
