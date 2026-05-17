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
        :sprite-data="appData.shipSprites[id]"
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
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { computed, onMounted, ref } from 'vue';
import ShipEditor from '../features/editors/components/ShipEditor.vue';
import WeaponEditor from '../features/editors/components/WeaponEditor.vue';
import ProjectileEditor from '../features/editors/components/ProjectileEditor.vue';
import WeaponFirePreview from '../features/editors/components/WeaponFirePreview.vue';
import {
  openProjectileEditorWindow,
  openWeaponPreviewWindow,
  type EditorSpecSavedEvent,
  type EditorWindowKind,
} from '../features/editors/editor-window';
import { useSettingsStore } from './settings.store';
import { loadProject } from '../features/project/project.service';
import type { AppData, RowData } from '../shared/types';
import { deepClone, defaultWeapon, rowId } from '../shared/lib/starsector';
import { formatError } from '../shared/lib/errors';
import WindowShell from './WindowShell.vue';
import { WINDOW_EVENTS } from '../features/windowing/window-events';

const params = new window.URLSearchParams(window.location.search);
const kind = ref<EditorWindowKind>(parseKind(params.get('kind')));
const modRoot = params.get('modRoot') ?? '';
const id = params.get('id') ?? '';
const starsectorRoot = params.get('starsectorRoot');
const appData = ref<AppData | null>(null);
const loading = ref(true);
const errorText = ref('');
const settings = useSettingsStore();

const weaponForEditor = computed<RowData>(() => {
  const data = appData.value;
  if (!data) return {};
  const csvRow = data.weapons.find((weapon) => rowId(weapon) === id);
  return data.wpnFiles[id] || defaultWeapon(id, csvRow);
});

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
  void getCurrentWindow().close();
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
  await emit(WINDOW_EVENTS.editorSpecSaved, payload);
}

function onShipSaved(savedId: string, ship: RowData) {
  if (appData.value) appData.value.shipFiles[savedId] = deepClone(ship);
  void emitSaved({ kind: 'ship', modRoot, id: savedId, spec: deepClone(ship) });
}

function onWeaponSaved(savedId: string, weapon: RowData) {
  if (appData.value) appData.value.wpnFiles[savedId] = deepClone(weapon);
  void emitSaved({ kind: 'weapon', modRoot, id: savedId, spec: deepClone(weapon) });
}

function onProjectileSaved(savedId: string, projectile: RowData) {
  if (appData.value) appData.value.projFiles[savedId] = deepClone(projectile);
  void emitSaved({ kind: 'projectile', modRoot, id: savedId, spec: deepClone(projectile) });
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

onMounted(() => void loadEditorData());
</script>
