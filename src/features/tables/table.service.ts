import { addCsvRow, deleteCsvRow, deleteShip, saveCsv, saveShip } from '../../shared/api/tauri';
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

export function createShipSpec(modRoot: string, id: string, ship: RowData) {
  return saveShip(modRoot, id, ship);
}

export function removeShipSpec(modRoot: string, id: string) {
  return deleteShip(modRoot, id);
}
