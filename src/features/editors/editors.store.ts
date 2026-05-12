import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppData, RowData } from '../../shared/types';
import { deepClone, defaultWeapon, rowId } from '../../shared/lib/starsector';

export const useEditorsStore = defineStore('editors', () => {
  const shipEditorId = ref('');
  const weaponEditorId = ref('');
  const projectileEditorId = ref('');
  const previewWeaponId = ref('');

  function openShip(id: string) {
    shipEditorId.value = id;
  }

  function closeShip() {
    shipEditorId.value = '';
  }

  function openWeapon(id: string) {
    weaponEditorId.value = id;
  }

  function closeWeapon() {
    weaponEditorId.value = '';
  }

  function openProjectile(id: string) {
    projectileEditorId.value = id;
  }

  function closeProjectile() {
    projectileEditorId.value = '';
  }

  function openPreview(id: string) {
    previewWeaponId.value = id;
  }

  function closePreview() {
    previewWeaponId.value = '';
  }

  function weaponForEditor(appData: AppData | null, weapons: RowData[]): RowData {
    if (!appData || !weaponEditorId.value) return {};
    const csvRow = weapons.find((weapon) => rowId(weapon) === weaponEditorId.value);
    return appData.wpnFiles[weaponEditorId.value] || defaultWeapon(weaponEditorId.value, csvRow);
  }

  function onShipSaved(appData: AppData | null, id: string, ship: RowData) {
    if (!appData) return;
    appData.shipFiles[id] = deepClone(ship);
  }

  function onWeaponSaved(appData: AppData | null, id: string, weapon: RowData) {
    if (!appData) return;
    appData.wpnFiles[id] = deepClone(weapon);
  }

  function onProjectileSaved(appData: AppData | null, id: string, projectile: RowData) {
    if (!appData) return;
    appData.projFiles[id] = deepClone(projectile);
  }

  return {
    projectileEditorId,
    previewWeaponId,
    shipEditorId,
    weaponEditorId,
    closePreview,
    closeProjectile,
    closeShip,
    closeWeapon,
    onProjectileSaved,
    onShipSaved,
    onWeaponSaved,
    openPreview,
    openProjectile,
    openShip,
    openWeapon,
    weaponForEditor,
  };
});
