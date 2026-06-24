<template>
  <div class="app-frame editor-window-app" :data-theme="settings.theme">
    <div v-if="loading" class="editor-window-status">
      <strong>正在加载</strong>
      <span>{{ target?.id ?? '缺少目标 id' }}</span>
    </div>
    <div v-else-if="errorText" class="editor-window-status editor-window-error">
      <strong>加载失败</strong>
      <span>{{ errorText }}</span>
    </div>
    <ShipEditor
      v-else-if="shipEditorData && target"
      :mod-root="target.modRoot"
      :session-id="target.sessionId"
      :hull-id="target.id"
      :ship="shipEditorData.ship"
      :sprite-data="shipSpriteForEditor"
      :draft-revision="draftRevision"
      :dirty="draftDirty"
      :can-save="canSaveSpec"
      :saving="draftSaving"
      :external-update-notice="externalUpdateNotice"
      @close="closeWindow"
      @save-requested="saveEditorData('ship')"
      @draft-changed="updateEditorDraft('ship', $event)"
      @load-external="loadPendingExternalSpec"
    />
    <WeaponEditor
      v-else-if="weaponEditorData && target"
      :mod-root="target.modRoot"
      :session-id="target.sessionId"
      :weapon-id="target.id"
      :weapon="weaponForEditor"
      :sprite-data="weaponEditorData.weaponSpriteData"
      :projectiles="weaponEditorData.projectileSpecs"
      :projectile-options="weaponEditorData.projectileOptions"
      :draft-revision="draftRevision"
      :dirty="draftDirty"
      :can-save="canSaveSpec"
      :saving="draftSaving"
      :external-update-notice="externalUpdateNotice"
      @close="closeWindow"
      @save-requested="saveEditorData('weapon')"
      @draft-changed="updateEditorDraft('weapon', $event)"
      @load-external="loadPendingExternalSpec"
      @edit-projectile="openProjectile"
      @preview="openPreview"
    />
    <ProjectileEditor
      v-else-if="projectileEditorData && target"
      :mod-root="target.modRoot"
      :session-id="target.sessionId"
      :projectile-id="target.id"
      :projectile="projectileEditorData.projectile"
      :draft-revision="draftRevision"
      :dirty="draftDirty"
      :can-save="canSaveSpec"
      :saving="draftSaving"
      :external-update-notice="externalUpdateNotice"
      @close="closeWindow"
      @save-requested="saveEditorData('projectile')"
      @draft-changed="updateEditorDraft('projectile', $event)"
      @load-external="loadPendingExternalSpec"
    />
    <SystemEditor
      v-else-if="systemEditorData && target"
      :mod-root="target.modRoot"
      :system-id="target.id"
      :system="systemEditorData.system"
      :draft-revision="draftRevision"
      :dirty="draftDirty"
      :can-save="canSaveSpec"
      :saving="draftSaving"
      :external-update-notice="externalUpdateNotice"
      @close="closeWindow"
      @save-requested="saveEditorData('system')"
      @draft-changed="updateEditorDraft('system', $event)"
      @load-external="loadPendingExternalSpec"
    />
    <WeaponFirePreview
      v-else-if="weaponPreviewData && target"
      :weapon-id="target.id"
      :weapon-csv-row="weaponPreviewData.weaponCsvRow"
      :weapon-spec="weaponForEditor"
      :projectile-specs="weaponPreviewData.projectileSpecs"
      :sprite-data="weaponPreviewData.weaponSpriteData"
      @close="closeWindow"
    />
    <div v-else class="editor-window-status editor-window-error">
      <strong>无法打开编辑器</strong>
      <span>{{ missingEditorText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ShipEditor from '@/app/components/editors/ShipEditor.vue';
import WeaponEditor from '@/app/components/editors/WeaponEditor.vue';
import ProjectileEditor from '@/app/components/editors/ProjectileEditor.vue';
import WeaponFirePreview from '@/app/components/editors/WeaponFirePreview.vue';
import SystemEditor from '@/app/components/editors/SystemEditor.vue';
import { openProjectileEditorWindow, openWeaponPreviewWindow } from '@/windows/editor.window';
import { useSettingsStore } from '@/stores/settings.store';
import { closeCurrentWindow } from '@/windows/current.window';
import { useEditorWindowViewModel } from '@/app/composables/use-editor-window-view-model';
import type { EditorSpecKind, EditorWindowKind } from '@/shared/types';
import { isEditorWindowKind } from '@/domain/editors/editor-definitions';

const params = new window.URLSearchParams(window.location.search);
const kind = ref<EditorWindowKind>(parseKind(params.get('kind')));
const sessionId = params.get('sessionId');
const modRoot = params.get('modRoot');
const id = params.get('id');
const starsectorRoot = params.get('starsectorRoot');
const settings = useSettingsStore();
const target = computed(() => (sessionId && modRoot && id ? { sessionId, modRoot, id } : null));

const {
  shipEditorData,
  weaponEditorData,
  projectileEditorData,
  weaponPreviewData,
  systemEditorData,
  loading,
  errorText,
  weaponForEditor,
  shipSpriteForEditor,
  draftDirty,
  draftRevision,
  draftSaving,
  canSaveSpec,
  externalUpdateNotice,
  missingEditorText,
  initializeEditorWindow,
  disposeEditorWindow,
  saveEditorData,
  updateEditorDraft,
  loadPendingExternalSpec,
} = useEditorWindowViewModel({ sessionId, modRoot, id, kind: kind.value });

function parseKind(value: string | null): EditorWindowKind {
  return isEditorWindowKind(value) ? value : 'ship';
}

function closeWindow() {
  void closeCurrentWindow();
}

function openProjectile(projectileId: string) {
  if (!projectileId || !target.value) return;
  void openProjectileEditorWindow({
    modRoot: target.value.modRoot,
    id: projectileId,
    sessionId: target.value.sessionId,
    settings: settings.settingsSnapshot(),
    starsectorRoot,
  });
}

function openPreview(weaponId: string) {
  if (!weaponId || !target.value) return;
  void openWeaponPreviewWindow({
    modRoot: target.value.modRoot,
    id: weaponId,
    sessionId: target.value.sessionId,
    settings: settings.settingsSnapshot(),
    starsectorRoot,
  });
}

function handleEditorWindowKeyDown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  const editableKind = resolveEditableKind();
  if (editableKind) void saveEditorData(editableKind);
}

function resolveEditableKind(): EditorSpecKind | null {
  if (kind.value === 'weapon-preview') return null;
  return kind.value as EditorSpecKind;
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorWindowKeyDown);
  void initializeEditorWindow();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorWindowKeyDown);
  disposeEditorWindow();
});
</script>
