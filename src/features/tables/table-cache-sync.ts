import type { AssociatedFileChange } from '../../shared/api/tables-api';
import { normalizeRelPath, pathStem } from '../../shared/lib/paths';
import type { AppData, RowData, TableKey } from '../../shared/types';
import { deepClone } from '../../shared/lib/starsector';

export function assignAppDataTable(appData: AppData, table: TableKey, rows: RowData[]) {
  const next = deepClone(rows);
  if (table === 'ships') appData.ships = next;
  else if (table === 'weapons') appData.weapons = next;
  else if (table === 'wings') appData.wings = next;
  else if (table === 'hullmods') appData.hullmods = next;
  else if (table === 'shipSystems') appData.shipSystems = next;
  else if (table === 'industries') appData.industries = next;
}

export function applyAssociatedFileCache(appData: AppData, files: AssociatedFileChange[]) {
  for (const file of files) {
    const relPath = normalizeRelPath(file.relPath);
    const id = pathStem(relPath);
    if (!id) continue;
    if (relPath.startsWith('data/hulls/') && relPath.endsWith('.ship')) {
      if (file.afterText === null) delete appData.shipFiles[id];
      else if (file.afterText !== undefined) appData.shipFiles[id] = parseAssociatedJson(file.afterText);
    } else if (relPath.startsWith('data/weapons/') && relPath.endsWith('.wpn')) {
      if (file.afterText === null) delete appData.wpnFiles[id];
      else if (file.afterText !== undefined) appData.wpnFiles[id] = parseAssociatedJson(file.afterText);
    } else if (relPath.startsWith('data/shipsystems/') && relPath.endsWith('.system')) {
      if (file.afterText === null) delete appData.systemFiles[id];
      else if (file.afterText !== undefined) appData.systemFiles[id] = parseAssociatedJson(file.afterText);
    }
  }
}

function parseAssociatedJson(text: string): RowData {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RowData) : {};
  } catch {
    return {};
  }
}
