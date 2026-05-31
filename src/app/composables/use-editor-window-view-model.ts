import { computed, ref } from 'vue';
import type { EditorSpecSavedEvent } from '@/windows/editor.window';
import type { UnlistenFn } from '@/windows/tauri.events';
import {
  queryEditorEntityBundle,
  loadImportedSpecFile,
  refreshEditorBundleProjectileDependencies,
  refreshEditorBundleResourceData,
  type EditorEntityBundle,
} from '@/services/editor.service';
import type { EditorSpecKind, EditorWindowKind, EntityKind, RowData } from '@/shared/types';
import { deepClone, defaultWeapon } from '@/shared/lib/starsector';
import { formatError } from '@/shared/lib/errors';
import { emitEditorSpecSaved, listenEditorSpecSaved } from '@/orchestrators/editor-window.orchestrator';
import {
  applyProjectSessionInvalidationToLocalCaches,
  listenProjectSessionInvalidated,
} from '@/orchestrators/project-session-invalidation.orchestrator';
import { saveEditorSpecByKind } from '@/services/editor.service';
import {
  queryCacheInvalidationIncludes,
  queryCacheInvalidationIncludesResourceIdentity,
  subscribeQueryCacheInvalidation,
} from '@/services/query-cache.service';
import { editorMissingTargetText, editorSpecExtension } from '@/domain/editors/editor-kind-metadata';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { pickEditorSpecFile } from '@/shared/runtime/dialog.runtime';
import { closeCurrentWindow } from '@/windows/current.window';
import type { QueryCacheInvalidationEvent } from '@/services/query-cache.service';
import type { ProjectSessionInvalidatedEvent } from '@/windows/window.events';

interface EditorWindowTarget {
  id: string;
  modRoot: string;
  sessionId: string;
}

type MissingSpecChoice = { action: 'create' } | { action: 'import'; data: RowData } | { action: 'cancel' };

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
  let unlistenProjectSessionInvalidated: UnlistenFn | null = null;
  let unsubscribeQueryCacheInvalidation: (() => void) | null = null;
  let editorDataRequestId = 0;
  let derivedDataRequestId = 0;

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

  async function queryEditorData(options: { promptForMissing: boolean; showLoading: boolean }) {
    const requestId = ++editorDataRequestId;
    derivedDataRequestId++;
    const target = editorWindowTarget();
    if (!target) {
      errorText.value = '缺少 Mod 路径或目标 id。';
      loading.value = false;
      return;
    }
    if (options.showLoading) loading.value = true;
    errorText.value = '';
    try {
      const data = await queryEditorEntityBundle(target.sessionId, params.kind, target.id);
      if (requestId !== editorDataRequestId || !sameEditorWindowTarget(target, editorWindowTarget())) return;
      editorData.value = data;
      if (data.isNew && params.kind !== 'weapon-preview' && options.promptForMissing) {
        const choice = await handleMissingSpec(params.kind, target);
        if (requestId !== editorDataRequestId || !sameEditorWindowTarget(target, editorWindowTarget())) return;
        if (choice.action === 'cancel') {
          void closeCurrentWindow();
          return;
        }
        if (choice.action === 'import') applyImportedSpec(params.kind, target.id, choice.data);
      }
    } catch (error) {
      if (requestId !== editorDataRequestId) return;
      errorText.value = formatError(error);
    } finally {
      if (requestId === editorDataRequestId) loading.value = false;
    }
  }

  async function handleMissingSpec(kind: EditorWindowKind, target: EditorWindowTarget): Promise<MissingSpecChoice> {
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
    if (!choice) return { action: 'cancel' };
    if (choice === 'import') {
      const path = await pickEditorSpecFile(ext);
      if (!path) return { action: 'cancel' };
      try {
        const data = await loadImportedSpecFile(specKind, path);
        return { action: 'import', data };
      } catch (error) {
        feedback.error(error, '无法读取或解析所选文件');
        return { action: 'cancel' };
      }
    }
    return { action: 'create' };
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
    const result = await saveEditorSpecByKind(target.sessionId, target.modRoot, kind, target.id, data);
    applySavedSpec(kind, target.id, data);
    await emitEditorSpecSaved({
      kind,
      sessionId: target.sessionId,
      modRoot: target.modRoot,
      id: target.id,
      spec: deepClone(data),
      writeResult: result,
    });
  }

  async function initializeEditorWindow() {
    unlistenEditorSpecSaved = await listenEditorSpecSaved(handleEditorSpecSaved);
    unlistenProjectSessionInvalidated = await listenProjectSessionInvalidated(handleProjectSessionInvalidated);
    unsubscribeQueryCacheInvalidation = subscribeQueryCacheInvalidation(handleQueryCacheInvalidated);
    void queryEditorData({ promptForMissing: true, showLoading: true });
  }

  function disposeEditorWindow() {
    unlistenEditorSpecSaved?.();
    unlistenEditorSpecSaved = null;
    unlistenProjectSessionInvalidated?.();
    unlistenProjectSessionInvalidated = null;
    unsubscribeQueryCacheInvalidation?.();
    unsubscribeQueryCacheInvalidation = null;
  }

  function handleEditorSpecSaved(event: EditorSpecSavedEvent) {
    const target = editorWindowTarget();
    if (!target || event.sessionId !== target.sessionId || event.modRoot !== target.modRoot || !editorData.value) return;
    if (!shouldApplySavedSpec(editorData.value, target, event)) return;
    applySavedSpec(event.kind, event.id, event.spec);
  }

  function applySavedSpec(kind: EditorSpecKind, id: string, data: RowData) {
    if (!editorData.value) return;
    const spec = deepClone(data);
    editorData.value = applySavedSpecToBundle(editorData.value, kind, id, spec);
  }

  function handleProjectSessionInvalidated(event: ProjectSessionInvalidatedEvent) {
    const target = editorWindowTarget();
    if (!target || event.manifest.sessionId !== target.sessionId || event.manifest.modRoot !== target.modRoot) return;
    applyProjectSessionInvalidationToLocalCaches(event);
  }

  function handleQueryCacheInvalidated(event: QueryCacheInvalidationEvent) {
    const target = editorWindowTarget();
    if (!target || event.sessionId !== target.sessionId) return;
    if (primaryEditorEntityDetailInvalidated(event, params.kind, target.id)) {
      void queryEditorData({ promptForMissing: false, showLoading: false });
      return;
    }
    const projectileSpecsChanged = editorProjectileDetailInvalidated(event, editorData.value);
    const projectileOptionsChanged = editorProjectileListInvalidated(event, params.kind);
    const resourcesChanged = queryCacheInvalidationIncludesResourceIdentity(
      event,
      editorData.value ? editorBundleResourceRefs(editorData.value) : [],
    );
    if (projectileSpecsChanged || projectileOptionsChanged || resourcesChanged) {
      void refreshEditorDerivedData({
        projectileOptions: projectileOptionsChanged,
        projectileSpecs: projectileSpecsChanged,
        resources: resourcesChanged,
      });
    }
  }

  async function refreshEditorDerivedData(options: { projectileSpecs: boolean; projectileOptions: boolean; resources: boolean }) {
    const target = editorWindowTarget();
    const bundle = editorData.value;
    if (!target || !bundle) return;
    const requestId = ++derivedDataRequestId;
    try {
      const projectileRefreshed =
        options.projectileSpecs || options.projectileOptions
          ? await refreshEditorBundleProjectileDependencies(target.sessionId, bundle, options)
          : bundle;
      const refreshed = options.resources
        ? await refreshEditorBundleResourceData(target.sessionId, projectileRefreshed)
        : projectileRefreshed;
      if (requestId !== derivedDataRequestId || editorData.value !== bundle || !sameEditorWindowTarget(target, editorWindowTarget()))
        return;
      editorData.value = refreshed;
    } catch (error) {
      feedback.error(error, '刷新编辑器派生数据失败');
    }
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

function sameEditorWindowTarget(left: EditorWindowTarget, right: EditorWindowTarget | null): boolean {
  return Boolean(right && left.sessionId === right.sessionId && left.modRoot === right.modRoot && left.id === right.id);
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

function editorBundleResourceRefs(bundle: EditorEntityBundle) {
  if (bundle.kind === 'ship' || bundle.kind === 'weapon' || bundle.kind === 'weapon-preview') return bundle.resourceRefs;
  return [];
}

function primaryEditorEntityDetailInvalidated(event: QueryCacheInvalidationEvent, windowKind: EditorWindowKind, id: string): boolean {
  const primaryKind = editorWindowEntityKind(windowKind);
  return queryCacheInvalidationIncludes(event, 'entity-detail', (parameters) => parameters.kind === primaryKind && parameters.id === id);
}

function editorProjectileDetailInvalidated(event: QueryCacheInvalidationEvent, bundle: EditorEntityBundle | null): boolean {
  if (bundle?.kind !== 'weapon' && bundle?.kind !== 'weapon-preview') return false;
  const projectileIds = Object.keys(bundle.projectileSpecs);
  if (projectileIds.length === 0) return false;
  return queryCacheInvalidationIncludes(
    event,
    'entity-detail',
    (parameters) => parameters.kind === 'projectile' && typeof parameters.id === 'string' && projectileIds.includes(parameters.id),
  );
}

function editorProjectileListInvalidated(event: QueryCacheInvalidationEvent, windowKind: EditorWindowKind): boolean {
  if (windowKind !== 'weapon') return false;
  return queryCacheInvalidationIncludes(event, 'entity-list', (parameters) => parameters.kind === 'projectile');
}

function editorWindowEntityKind(windowKind: EditorWindowKind): EntityKind {
  return windowKind === 'weapon-preview' ? 'weapon' : windowKind;
}
