<template>
  <WindowShell>
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
        v-else-if="kind === 'ship' && appData && appData.shipFiles[id]"
        :mod-root="modRoot"
        :hull-id="id"
        :ship="appData.shipFiles[id]"
        :sprite-data="shipSpriteForEditor"
        @close="closeWindow"
        @saved="onShipSaved"
      />
      <WeaponEditor
        v-else-if="kind === 'weapon' && appData"
        :mod-root="modRoot"
        :weapon-id="id"
        :weapon="weaponForEditor"
        :sprite-data="appData.weaponSpritesData[id]"
        :projectiles="appData.projFiles"
        @close="closeWindow"
        @saved="onWeaponSaved"
        @edit-projectile="openProjectile"
        @preview="openPreview"
      />
      <ProjectileEditor
        v-else-if="kind === 'projectile' && appData"
        :mod-root="modRoot"
        :projectile-id="id"
        :projectile="appData.projFiles[id]"
        @close="closeWindow"
        @saved="onProjectileSaved"
      />
      <WeaponFirePreview
        v-else-if="kind === 'weapon-preview' && appData"
        :weapon-id="id"
        :weapons="appData.weapons"
        :wpn-files="appData.wpnFiles"
        :proj-files="appData.projFiles"
        :sprite-data="appData.weaponSpritesData[id]"
        @close="closeWindow"
      />
      <div v-else class="editor-window-status editor-window-error">
        <strong>无法打开编辑器</strong>
        <span>{{ missingEditorText }}</span>
      </div>
    </div>
  </WindowShell>
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
import { loadProject } from '@/services/project.service';
import type { AppData, RowData } from '@/shared/types';
import { deepClone, defaultWeapon, rowSpecId } from '@/shared/lib/starsector';
import { resolveHullSprite } from '@/shared/lib/hull-references';
import { formatError } from '@/shared/lib/errors';
import WindowShell from '@/app/WindowShell.vue';
import { closeCurrentWindow } from '@/windows/current.window';
import { WINDOW_EVENTS } from '@/windows/window.events';
import { emitWindowEvent, listenWindowEvent, type UnlistenFn } from '@/windows/tauri.events';

const params = new window.URLSearchParams(window.location.search);
const kind = ref<EditorWindowKind>(parseKind(params.get('kind')));
const modRoot = params.get('modRoot') ?? '';
const id = params.get('id') ?? '';
const starsectorRoot = params.get('starsectorRoot');
const appData = ref<AppData | null>(null);
const loading = ref(true);
const errorText = ref('');
const settings = useSettingsStore();
let unlistenEditorSpecApplied: UnlistenFn | null = null;

const weaponForEditor = computed<RowData>(() => {
  const data = appData.value;
  if (!data) return {};
  const csvRow = data.weapons.find((weapon) => rowSpecId(weapon, 'weapons') === id);
  return data.wpnFiles[id] || defaultWeapon(id, csvRow);
});
const shipSpriteForEditor = computed(() => resolveHullSprite(appData.value, id, 'mod'));

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
  if (!modRoot || !id) {
    errorText.value = '缺少 Mod 路径或目标 id。';
    loading.value = false;
    return;
  }
  try {
    appData.value = await loadProject(modRoot, starsectorRoot);
  } catch (error) {
    errorText.value = formatError(error);
  } finally {
    loading.value = false;
  }
}

async function emitSaved(payload: EditorSpecSavedEvent) {
  await emitWindowEvent(WINDOW_EVENTS.editorSpecSaved, payload);
}

function handleEditorSpecApplied(payload: EditorSpecSavedEvent) {
  if (payload.modRoot !== modRoot || payload.id !== id || payload.kind !== kind.value || !appData.value) return;
  const spec = deepClone(payload.spec);
  if (payload.kind === 'ship') {
    appData.value.shipFiles[payload.id] = spec;
  } else if (payload.kind === 'weapon') {
    appData.value.wpnFiles[payload.id] = spec;
  } else {
    appData.value.projFiles[payload.id] = spec;
  }
}

function onShipSaved(savedId: string, ship: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (appData.value) appData.value.shipFiles[savedId] = deepClone(ship);
  void emitSaved({ kind: 'ship', modRoot, id: savedId, spec: deepClone(ship), changes });
}

function onWeaponSaved(savedId: string, weapon: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (appData.value) appData.value.wpnFiles[savedId] = deepClone(weapon);
  void emitSaved({ kind: 'weapon', modRoot, id: savedId, spec: deepClone(weapon), changes });
}

function onProjectileSaved(savedId: string, projectile: RowData, changes: EditorSpecSavedEvent['changes']) {
  if (appData.value) appData.value.projFiles[savedId] = deepClone(projectile);
  void emitSaved({ kind: 'projectile', modRoot, id: savedId, spec: deepClone(projectile), changes });
}

function openProjectile(projectileId: string) {
  if (!projectileId) return;
  void openProjectileEditorWindow({
    modRoot,
    id: projectileId,
    starsectorRoot: appData.value?.starsectorRoot ?? starsectorRoot,
  });
}

function openPreview(weaponId: string) {
  if (!weaponId) return;
  void openWeaponPreviewWindow({
    modRoot,
    id: weaponId,
    starsectorRoot: appData.value?.starsectorRoot ?? starsectorRoot,
  });
}

onMounted(async () => {
  unlistenEditorSpecApplied = await listenWindowEvent<EditorSpecSavedEvent>(WINDOW_EVENTS.editorSpecApplied, (payload) => {
    handleEditorSpecApplied(payload);
  });
  void loadEditorData();
});

onUnmounted(() => {
  unlistenEditorSpecApplied?.();
  unlistenEditorSpecApplied = null;
});
</script>
