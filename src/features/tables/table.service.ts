import { addCsvRow, addShipRow, addWeaponRow, deleteCsvRow, deleteShipRow, deleteWeaponRow, saveCsv } from '../../shared/api/tauri';
import type { RowData, TableKey } from '../../shared/types';

export function saveTableRows(modRoot: string, table: TableKey, header: string[], rows: RowData[]) {
  return saveCsv(modRoot, table, header, rows);
}

export function createTableRow(modRoot: string, table: TableKey, header: string[], row: RowData) {
  return addCsvRow(modRoot, table, header, row);
}

export function removeTableRow(modRoot: string, table: TableKey, id: string) {
  return deleteCsvRow(modRoot, table, id);
}

export function createShipRecord(modRoot: string, header: string[], row: RowData, ship: RowData) {
  return addShipRow(modRoot, header, row, ship);
}

export function removeShipRecord(modRoot: string, id: string) {
  return deleteShipRow(modRoot, id);
}

export function createWeaponRecord(modRoot: string, header: string[], row: RowData, weapon: RowData) {
  return addWeaponRow(modRoot, header, row, weapon);
}

export function removeWeaponRecord(modRoot: string, id: string) {
  return deleteWeaponRow(modRoot, id);
}
