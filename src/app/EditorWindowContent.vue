<template>
  <div class="app-frame editor-window-app" :data-theme="settings.theme">
    <div v-if="loading" class="editor-window-status">
      <strong>正在加载</strong>
      <span>{{ id }}</span>
    </div>
    <div v-else-if="errorText" class="editor-window-status editor-window-error">
      <strong>加载失败</strong>
      <span>{{ errorText }}</span>
    </div>
    <ShipEditor
      v-else-if="kind === 'ship' && editorData"
      :mod-root="modRoot"
      :hull-id="id"
      :ship="editorData.ship"
      :sprite-data="shipSpriteForEditor"
      :save-spec="(ship) => saveEditorSpec('ship', ship)"
      @close="closeWindow"
      @saved="onShipSaved"
    />
    <WeaponEditor
      v-else-if="kind === 'weapon' && editorData"
      :mod-root="modRoot"
      :weapon-id="id"
      :weapon="weaponForEditor"
      :sprite-data="editorData.weaponSpriteData"
      :projectiles="editorData.projectiles"
      :projectile-options="editorData.projectileOptions"
      :save-spec="(weapon) => saveEditorSpec('weapon', weapon)"
      @close="closeWindow"
      @saved="onWeaponSaved"
      @edit-projectile="openProjectile"
      @preview="openPreview"
    />
    <ProjectileEditor
      v-else-if="kind === 'projectile' && editorData"
      :mod-root="modRoot"
      :projectile-id="id"
      :projectile="editorData.projectile"
      :save-spec="(projectile) => saveEditorSpec('projectile', projectile)"
      @close="closeWindow"
      @saved="onProjectileSaved"
    />
    <WeaponFirePreview
      v-else-if="kind === 'weapon-preview' && editorData"
      :weapon-id="id"
      :weapon-row="editorData.weaponRow"
      :wpn-files="editorData.weaponFiles"
      :proj-files="editorData.projectiles"
      :sprite-data="editorData.weaponSpriteData"
      @close="closeWindow"
    />
    <div v-else class="editor-window-status editor-window-error">
      <strong>无法打开编辑器</strong>
      <span>{{ missingEditorText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import ShipEditor from '@/app/components/editors/ShipEditor.vue';
import WeaponEditor from '@/app/components/editors/WeaponEditor.vue';
import ProjectileEditor from '@/app/components/editors/ProjectileEditor.vue';
import WeaponFirePreview from '@/app/components/editors/WeaponFirePreview.vue';
import {
  openProjectileEditorWindow,
  openWeaponPreviewWindow,
  type EditorSpecSavedEvent,
  type EditorWindowKind,
} from '@/windows/editor.window';
import { useSettingsStore } from '@/stores/settings.store';
import type { RowData } from '@/shared/types';
import { deepClone } from '@/shared/lib/starsector';
import { closeCurrentWindow } from '@/windows/current.window';
import type { UnlistenFn } from '@/windows/tauri.events';
import { emitEditorSpecSaved, listenEditorSpecApplied } from '@/orchestrators/editor-window.orchestrator';
import { useEditorWindowViewModel } from '@/app/composables/use-editor-window-view-model';

const params = new window.URLSearchParams(window.location.search);
const kind = ref<EditorWindowKind>(parseKind(params.get('kind')));
const sessionId = params.get('sessionId') ?? '';
const modRoot = params.get('modRoot') ?? '';
const id = params.get('id') ?? '';
const starsectorRoot = params.get('starsectorRoot');
const settings = useSettingsStore();
let unlistenEditorSpecApplied: UnlistenFn | null = null;

const { editorData, loading, errorText, weaponForEditor, shipSpriteForEditor, missingEditorText, queryEditorData, saveEditorSpec } =
  useEditorWindowViewModel({ sessionId, modRoot, id, kind: kind.value });

function parseKind(value: string | null): EditorWindowKind {
  if (value === 'ship' || value === 'weapon' || value === 'projectile' || value === 'weapon-preview') return value;
  return 'ship';
}

function closeWindow() {
  void closeCurrentWindow();
}

async function emitSaved(payload: EditorSpecSavedEvent) {
  await emitEditorSpecSaved(payload);
}

function handleEditorSpecApplied(payload: EditorSpecSavedEvent) {
  if (payload.modRoot !== modRoot || payload.id !== id || payload.kind !== kind.value || !editorData.value) return;
  const spec = deepClone(payload.spec);
  if (payload.kind === 'ship') {
    editorData.value.ship = spec;
  } else if (payload.kind === 'weapon') {
    editorData.value.weapon = spec;
    editorData.value.weaponFiles[payload.id] = spec;
  } else {
    editorData.value.projectile = spec;
    editorData.value.projectiles[payload.id] = spec;
  }
}

function onShipSaved(savedId: string, ship: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (editorData.value) editorData.value.ship = deepClone(ship);
  void emitSaved({ kind: 'ship', modRoot, id: savedId, spec: deepClone(ship), changes });
}

function onWeaponSaved(savedId: string, weapon: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (editorData.value) {
    editorData.value.weapon = deepClone(weapon);
    editorData.value.weaponFiles[savedId] = deepClone(weapon);
  }
  void emitSaved({ kind: 'weapon', modRoot, id: savedId, spec: deepClone(weapon), changes });
}

function onProjectileSaved(savedId: string, projectile: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (editorData.value) {
    editorData.value.projectile = deepClone(projectile);
    editorData.value.projectiles[savedId] = deepClone(projectile);
  }
  void emitSaved({ kind: 'projectile', modRoot, id: savedId, spec: deepClone(projectile), changes });
}

function openProjectile(projectileId: string) {
  if (!projectileId) return;
  void openProjectileEditorWindow({
    modRoot,
    id: projectileId,
    sessionId,
    settings: settings.settingsSnapshot(),
    starsectorRoot,
  });
}

function openPreview(weaponId: string) {
  if (!weaponId) return;
  void openWeaponPreviewWindow({
    modRoot,
    id: weaponId,
    sessionId,
    settings: settings.settingsSnapshot(),
    starsectorRoot,
  });
}

onMounted(async () => {
  unlistenEditorSpecApplied = await listenEditorSpecApplied((payload) => {
    handleEditorSpecApplied(payload);
  });
  void queryEditorData();
});

onUnmounted(() => {
  unlistenEditorSpecApplied?.();
  unlistenEditorSpecApplied = null;
});
</script>
