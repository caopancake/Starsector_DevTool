import { computed, ref } from 'vue';
import type { EditorSpecSavedEvent } from '@/windows/editor.window';
import type { UnlistenFn } from '@/windows/tauri.events';
import { queryEditorEntityBundle, loadImportedSpecFile, type EditorEntityBundle } from '@/services/editor.service';
import type { EditorSpecKind, EditorWindowKind, RowData } from '@/shared/types';
import { deepClone, defaultWeapon } from '@/shared/lib/starsector';
import { formatError } from '@/shared/lib/errors';
import { emitEditorSpecSaved, listenEditorSpecSaved } from '@/orchestrators/editor-window.orchestrator';
import { saveEditorSpecByKind } from '@/services/editor.service';
import { editorMissingTargetText, editorSpecExtension } from '@/domain/editors/editor-kind-metadata';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { pickEditorSpecFile } from '@/shared/runtime/dialog.runtime';
import { closeCurrentWindow } from '@/windows/current.window';

interface EditorWindowTarget {
  id: string;
  modRoot: string;
  sessionId: string;
}

export function useEditorWindowViewModel(params: {
  sessionId: string | null;
  modRoot: string | null;
  id: string | null;
  kind: EditorWindowKind;
}) {
  const editorData = ref<EditorEntityBundle | null>(null);
  const loading = ref(true);
  const errorText = ref('');
  const feedback = useAppFeedback();
  let unlistenEditorSpecSaved: UnlistenFn | null = null;

  const shipEditorData = computed(() => (editorData.value?.kind === 'ship' ? editorData.value : null));
  const weaponEditorData = computed(() => (editorData.value?.kind === 'weapon' ? editorData.value : null));
  const projectileEditorData = computed(() => (editorData.value?.kind === 'projectile' ? editorData.value : null));
  const weaponPreviewData = computed(() => (editorData.value?.kind === 'weapon-preview' ? editorData.value : null));
  const systemEditorData = computed(() => (editorData.value?.kind === 'system' ? editorData.value : null));
  const weaponLikeEditorData = computed(() => {
    const data = editorData.value;
    return data?.kind === 'weapon' || data?.kind === 'weapon-preview' ? data : null;
  });
  const weaponForEditor = computed<RowData>(() => {
    const data = weaponLikeEditorData.value;
    const target = editorWindowTarget();
    if (!data || !target) return {};
    return Object.keys(data.weapon).length > 0 ? data.weapon : defaultWeapon(target.id, data.weaponCsvRow);
  });
  const shipSpriteForEditor = computed(() => shipEditorData.value?.shipSpriteData ?? '');

  const missingEditorText = computed(() => {
    const target = editorWindowTarget();
    if (!target) return '缺少 Mod 路径或目标 id。';
    return editorMissingTargetText(params.kind, target.id);
  });

  async function queryEditorData() {
    const target = editorWindowTarget();
    if (!target) {
      errorText.value = '缺少 Mod 路径或目标 id。';
      loading.value = false;
      return;
    }
    try {
      editorData.value = await queryEditorEntityBundle(target.sessionId, params.kind, target.id);
      if (editorData.value && editorData.value.isNew && params.kind !== 'weapon-preview') {
        const choice = await handleMissingSpec(params.kind, target);
        if (choice === 'cancel') {
          void closeCurrentWindow();
          return;
        }
      }
    } catch (error) {
      errorText.value = formatError(error);
    } finally {
      loading.value = false;
    }
  }

  async function handleMissingSpec(kind: EditorWindowKind, target: EditorWindowTarget): Promise<'create' | 'import' | 'cancel'> {
    const specKind = kind as EditorSpecKind;
    const ext = editorSpecExtension(specKind);
    const choice = await feedback.choose({
      title: `找不到 ${target.id}.${ext}`,
      content: '目标文件不存在，请选择操作：',
      choices: [
        { label: '新建文件', value: 'create', type: 'primary' },
        { label: '导入已有文件', value: 'import' },
      ],
    });
    if (!choice) return 'cancel';
    if (choice === 'import') {
      const path = await pickEditorSpecFile(ext);
      if (!path) return 'cancel';
      try {
        const data = await loadImportedSpecFile(path);
        applyImportedSpec(kind, target.id, data);
        return 'import';
      } catch (error) {
        feedback.error(error, '无法读取或解析所选文件');
        return 'cancel';
      }
    }
    return 'create';
  }

  function applyImportedSpec(kind: EditorWindowKind, id: string, data: RowData) {
    if (!editorData.value) return;
    if (kind === 'ship' && editorData.value.kind === 'ship') {
      editorData.value = { ...editorData.value, ship: data, isNew: false };
    } else if (kind === 'weapon' && editorData.value.kind === 'weapon') {
      editorData.value = { ...editorData.value, weapon: data, isNew: false };
    } else if (kind === 'projectile' && editorData.value.kind === 'projectile') {
      editorData.value = { ...editorData.value, projectile: data, projectileSpecs: { [id]: data }, isNew: false };
    } else if (kind === 'system' && editorData.value.kind === 'system') {
      editorData.value = { ...editorData.value, system: data, isNew: false };
    }
  }

  async function saveEditorData(kind: EditorSpecKind, data: RowData): Promise<void> {
    const target = editorWindowTarget();
    if (!target) return;
    const result = await saveEditorSpecByKind(target.modRoot, kind, target.id, data);
    applySavedSpec(kind, target.id, data);
    await emitEditorSpecSaved({ kind, modRoot: target.modRoot, id: target.id, spec: deepClone(data), writeResult: result });
  }

  async function initializeEditorWindow() {
    unlistenEditorSpecSaved = await listenEditorSpecSaved(handleEditorSpecSaved);
    void queryEditorData();
  }

  function disposeEditorWindow() {
    unlistenEditorSpecSaved?.();
    unlistenEditorSpecSaved = null;
  }

  function handleEditorSpecSaved(event: EditorSpecSavedEvent) {
    const target = editorWindowTarget();
    if (!target || event.modRoot !== target.modRoot || !editorData.value) return;
    if (!shouldApplySavedSpec(editorData.value, target, event)) return;
    applySavedSpec(event.kind, event.id, event.spec);
  }

  function applySavedSpec(kind: EditorSpecKind, id: string, data: RowData) {
    if (!editorData.value) return;
    const spec = deepClone(data);
    editorData.value = applySavedSpecToBundle(editorData.value, kind, id, spec);
  }

  function editorWindowTarget(): EditorWindowTarget | null {
    if (!params.sessionId || !params.modRoot || !params.id) return null;
    return { sessionId: params.sessionId, modRoot: params.modRoot, id: params.id };
  }

  return {
    editorData,
    shipEditorData,
    weaponEditorData,
    projectileEditorData,
    weaponPreviewData,
    systemEditorData,
    loading,
    errorText,
    weaponForEditor,
    shipSpriteForEditor,
    missingEditorText,
    initializeEditorWindow,
    disposeEditorWindow,
    saveEditorData,
  };
}

function shouldApplySavedSpec(bundle: EditorEntityBundle, target: EditorWindowTarget, event: EditorSpecSavedEvent): boolean {
  if (event.kind === 'ship') return bundle.kind === 'ship' && event.id === target.id;
  if (event.kind === 'weapon') return (bundle.kind === 'weapon' || bundle.kind === 'weapon-preview') && event.id === target.id;
  if (event.kind === 'projectile') {
    if (bundle.kind === 'projectile') return event.id === target.id;
    if (bundle.kind === 'weapon' || bundle.kind === 'weapon-preview') return event.id in bundle.projectileSpecs;
  }
  if (event.kind === 'system') return bundle.kind === 'system' && event.id === target.id;
  return false;
}

function applySavedSpecToBundle(bundle: EditorEntityBundle, kind: EditorSpecKind, id: string, spec: RowData): EditorEntityBundle {
  if (kind === 'ship' && bundle.kind === 'ship') return { ...bundle, ship: spec };
  if (kind === 'weapon' && (bundle.kind === 'weapon' || bundle.kind === 'weapon-preview')) return { ...bundle, weapon: spec };
  if (kind === 'projectile' && bundle.kind === 'projectile') {
    return { ...bundle, projectile: spec, projectileSpecs: { ...bundle.projectileSpecs, [id]: spec } };
  }
  if (kind === 'projectile' && (bundle.kind === 'weapon' || bundle.kind === 'weapon-preview')) {
    return { ...bundle, projectileSpecs: { ...bundle.projectileSpecs, [id]: spec } };
  }
  if (kind === 'system' && bundle.kind === 'system') return { ...bundle, system: spec };
  return bundle;
}
