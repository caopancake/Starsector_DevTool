<template>
  <ShipEditor
    v-if="project.data && editors.shipEditorId"
    :mod-root="project.data.modRoot"
    :hull-id="editors.shipEditorId"
    :ship="project.data.shipFiles[editors.shipEditorId]"
    :sprite-data="project.data.shipSprites[editors.shipEditorId]"
    :available-sprites="project.data.availableSprites"
    @close="editors.closeShip"
    @saved="onShipSaved"
  />
  <WeaponEditor
    v-if="project.data && editors.weaponEditorId"
    :mod-root="project.data.modRoot"
    :weapon-id="editors.weaponEditorId"
    :weapon="editors.weaponForEditor(project.data, tables.tables.weapons)"
    :sprite-data="project.data.weaponSpritesData[editors.weaponEditorId]"
    :projectiles="project.data.projFiles"
    @close="editors.closeWeapon"
    @saved="onWeaponSaved"
    @edit-projectile="editors.openProjectile"
    @preview="editors.openPreview"
  />
  <ProjectileEditor
    v-if="project.data && editors.projectileEditorId"
    :mod-root="project.data.modRoot"
    :projectile-id="editors.projectileEditorId"
    :projectile="project.data.projFiles[editors.projectileEditorId]"
    @close="editors.closeProjectile"
    @saved="onProjectileSaved"
  />
  <BallisticPreview
    v-if="project.data && editors.previewWeaponId"
    :weapon-id="editors.previewWeaponId"
    :weapons="tables.tables.weapons"
    :wpn-files="project.data.wpnFiles"
    :proj-files="project.data.projFiles"
    @close="editors.closePreview"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import ShipEditor from '../features/editors/components/ShipEditor.vue';
import WeaponEditor from '../features/editors/components/WeaponEditor.vue';
import ProjectileEditor from '../features/editors/components/ProjectileEditor.vue';
import BallisticPreview from '../features/editors/components/BallisticPreview.vue';
import { useEditorsStore } from '../features/editors/editors.store';
import { useProjectStore } from '../features/project/project.store';
import { useTablesStore } from '../features/tables/tables.store';
import type { RowData } from '../shared/types';
import { useSettingsStore } from './settings.store';

const editors = useEditorsStore();
const project = useProjectStore();
const tables = useTablesStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

function onShipSaved(id: string, ship: RowData) {
  editors.onShipSaved(project.data, id, ship);
  message.success(`${id}.ship 已保存`);
}

function onWeaponSaved(id: string, weapon: RowData) {
  editors.onWeaponSaved(project.data, id, weapon);
  message.success(`${id}.wpn 已保存`);
}

function onProjectileSaved(id: string, projectile: RowData) {
  editors.onProjectileSaved(project.data, id, projectile);
  message.success(`${id}.proj 已保存`);
}
</script>
