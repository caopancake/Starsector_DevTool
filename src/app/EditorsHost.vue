<template>
  <!-- Ship Editor uses modRoot from editor state, not current project.activeModData -->
  <ShipEditor
    v-if="editors.shipEditorId && project.getModData(editors.shipEditorId.modRoot)"
    :mod-root="editors.shipEditorId.modRoot"
    :hull-id="editors.shipEditorId.id"
    :ship="project.getModData(editors.shipEditorId.modRoot)!.shipFiles[editors.shipEditorId.id]"
    :sprite-data="project.getModData(editors.shipEditorId.modRoot)!.shipSprites[editors.shipEditorId.id]"
    @close="editors.closeShip"
    @saved="onShipSaved"
  />
  <!-- Weapon Editor uses modRoot from editor state, not current project.activeModData -->
  <WeaponEditor
    v-if="editors.weaponEditorId && project.getModData(editors.weaponEditorId.modRoot)"
    :mod-root="editors.weaponEditorId.modRoot"
    :weapon-id="editors.weaponEditorId.id"
    :weapon="editors.weaponForEditor(project.getModData(editors.weaponEditorId.modRoot), getWeaponsForMod(editors.weaponEditorId.modRoot))"
    :sprite-data="project.getModData(editors.weaponEditorId.modRoot)!.weaponSpritesData[editors.weaponEditorId.id]"
    :projectiles="project.getModData(editors.weaponEditorId.modRoot)!.projFiles"
    @close="editors.closeWeapon"
    @saved="onWeaponSaved"
    @edit-projectile="editors.openProjectile"
    @preview="editors.openPreview"
  />
  <!-- Projectile Editor uses modRoot from editor state -->
  <ProjectileEditor
    v-if="editors.projectileEditorId && project.getModData(editors.projectileEditorId.modRoot)"
    :mod-root="editors.projectileEditorId.modRoot"
    :projectile-id="editors.projectileEditorId.id"
    :projectile="project.getModData(editors.projectileEditorId.modRoot)?.projFiles[editors.projectileEditorId.id]"
    @close="editors.closeProjectile"
    @saved="onProjectileSaved"
  />
  <!-- Preview uses current active mod since it's display-only -->
  <WeaponFirePreview
    v-if="project.activeModData && editors.previewWeaponId"
    :weapon-id="editors.previewWeaponId"
    :weapons="tables.tables.weapons"
    :wpn-files="project.activeModData.wpnFiles"
    :proj-files="project.activeModData.projFiles"
    @close="editors.closePreview"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import ShipEditor from '../features/editors/components/ShipEditor.vue';
import WeaponEditor from '../features/editors/components/WeaponEditor.vue';
import ProjectileEditor from '../features/editors/components/ProjectileEditor.vue';
import WeaponFirePreview from '../features/editors/components/WeaponFirePreview.vue';
import { useEditorsStore } from '../features/editors/editors.store';
import { useHistoryStore } from '../features/history/history.store';
import { useProjectStore } from '../features/project/project.store';
import { useTablesStore } from '../features/tables/tables.store';
import type { RowData } from '../shared/types';
import { deepClone } from '../shared/lib/starsector';
import { useSettingsStore } from './settings.store';
import { buildThemeOverrides, discreteConfigProviderProps } from './theme-overrides';

const editors = useEditorsStore();
const project = useProjectStore();
const tables = useTablesStore();
const settings = useSettingsStore();
const history = useHistoryStore();
const themeOverrides = computed(() => buildThemeOverrides(settings));

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => discreteConfigProviderProps(settings, themeOverrides)),
});

/**
 * Get weapons for a specific mod. Editor state tracks which mod it belongs to,
 * so we need to get weapons from that mod, not the active mod.
 */
function getWeaponsForMod(modRoot: string): RowData[] {
  const modData = project.getModData(modRoot);
  return modData?.weapons ?? [];
}

function onShipSaved(id: string, ship: RowData) {
  if (editors.shipEditorId?.modRoot) {
    const modRoot = editors.shipEditorId.modRoot;
    const modData = project.getModData(modRoot);
    const previousSpec = modData?.shipFiles[id] ? deepClone(modData.shipFiles[id]) : {};
    project.updateShipFile(modRoot, id, ship);
    history.pushEvent({ type: 'editor-save', editorKind: 'ship', id, previousSpec, newSpec: deepClone(ship) }, `保存 ${id}.ship`);
    history.pushCheckpoint('editor-save', `${id}.ship 已保存`);
    message.success(`${id}.ship 已保存`);
  }
}

function onWeaponSaved(id: string, weapon: RowData) {
  if (editors.weaponEditorId?.modRoot) {
    const modRoot = editors.weaponEditorId.modRoot;
    const modData = project.getModData(modRoot);
    const previousSpec = modData?.wpnFiles[id] ? deepClone(modData.wpnFiles[id]) : {};
    project.updateWeaponFile(modRoot, id, weapon);
    history.pushEvent({ type: 'editor-save', editorKind: 'weapon', id, previousSpec, newSpec: deepClone(weapon) }, `保存 ${id}.wpn`);
    history.pushCheckpoint('editor-save', `${id}.wpn 已保存`);
    message.success(`${id}.wpn 已保存`);
  }
}

function onProjectileSaved(id: string, projectile: RowData) {
  if (editors.projectileEditorId?.modRoot) {
    const modRoot = editors.projectileEditorId.modRoot;
    const modData = project.getModData(modRoot);
    const previousSpec = modData?.projFiles[id] ? deepClone(modData.projFiles[id]) : {};
    project.updateProjectileFile(modRoot, id, projectile);
    history.pushEvent(
      { type: 'editor-save', editorKind: 'projectile', id, previousSpec, newSpec: deepClone(projectile) },
      `保存 ${id}.proj`,
    );
    history.pushCheckpoint('editor-save', `${id}.proj 已保存`);
    message.success(`${id}.proj 已保存`);
  }
}
</script>
