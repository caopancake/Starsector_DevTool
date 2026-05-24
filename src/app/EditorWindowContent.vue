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
import { computed, onMounted, onUnmounted, ref } from 'vue';
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
import { queryEditorEntityBundle, type EditorEntityBundle } from '@/services/editor.service';
import type { RowData } from '@/shared/types';
import { deepClone, defaultWeapon } from '@/shared/lib/starsector';
import { formatError } from '@/shared/lib/errors';
import { closeCurrentWindow } from '@/windows/current.window';
import type { UnlistenFn } from '@/windows/tauri.events';
import { emitEditorSpecSaved, listenEditorSpecApplied } from '@/orchestrators/editor-window.orchestrator';

const params = new window.URLSearchParams(window.location.search);
const kind = ref<EditorWindowKind>(parseKind(params.get('kind')));
const sessionId = params.get('sessionId') ?? '';
const modRoot = params.get('modRoot') ?? '';
const id = params.get('id') ?? '';
const starsectorRoot = params.get('starsectorRoot');
const editorData = ref<EditorEntityBundle | null>(null);
const loading = ref(true);
const errorText = ref('');
const settings = useSettingsStore();
let unlistenEditorSpecApplied: UnlistenFn | null = null;

const weaponForEditor = computed<RowData>(() => {
  const data = editorData.value;
  if (!data) return {};
  return data.weaponFiles[id] || defaultWeapon(id, data.weaponRow);
});
const shipSpriteForEditor = computed(() => editorData.value?.shipSpriteData ?? '');

const missingEditorText = computed(() => {
  if (!modRoot || !id) return '缺少 Mod 路径或目标 id。';
  if (kind.value === 'ship') return `找不到 ${id}.ship。`;
  if (kind.value === 'weapon') return `找不到 ${id}.wpn。`;
  if (kind.value === 'projectile') return `找不到 ${id}.proj。`;
  return `找不到 ${id} 的预览数据。`;
});

function parseKind(value: string | null): EditorWindowKind {
  if (value === 'ship' || value === 'weapon' || value === 'projectile' || value === 'weapon-preview') return value;
  return 'ship';
}

function closeWindow() {
  void closeCurrentWindow();
}

async function loadEditorData() {
  if (!sessionId || !modRoot || !id) {
    errorText.value = '缺少 Mod 路径或目标 id。';
    loading.value = false;
    return;
  }
  try {
    editorData.value = await queryEditorEntityBundle(sessionId, kind.value, id);
  } catch (error) {
    errorText.value = formatError(error);
  } finally {
    loading.value = false;
  }
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
  void loadEditorData();
});

onUnmounted(() => {
  unlistenEditorSpecApplied?.();
  unlistenEditorSpecApplied = null;
});
</script>
