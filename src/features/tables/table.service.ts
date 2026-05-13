import { addCsvRow, addShipRow, addWeaponRow, deleteCsvRow, deleteShipRow, deleteWeaponRow, saveCsv } from '../../shared/api/tauri';
import { AppError, withCause } from '../../shared/lib/errors';
import type { RowData, TableKey } from '../../shared/types';

export async function saveTableRows(modRoot: string, table: TableKey, header: string[], rows: RowData[]) {
  ensureCsvContext(modRoot, header, table);
  try {
    return await saveCsv(modRoot, table, header, rows);
  } catch (error) {
    throw withCause(`保存 ${table} CSV 失败`, error, 'save-table-rows');
  }
}

export async function createTableRow(modRoot: string, table: TableKey, header: string[], row: RowData) {
  ensureCsvContext(modRoot, header, table);
  try {
    return await addCsvRow(modRoot, table, header, row);
  } catch (error) {
    throw withCause(`新建 ${table} CSV 行失败`, error, 'create-table-row');
  }
}

export async function removeTableRow(modRoot: string, table: TableKey, id: string) {
  ensureRecordId(id, table);
  try {
    return await deleteCsvRow(modRoot, table, id);
  } catch (error) {
    throw withCause(`删除 ${table} CSV 行失败`, error, 'remove-table-row');
  }
}

export async function createShipRecord(modRoot: string, header: string[], row: RowData, ship: RowData) {
  ensureCsvContext(modRoot, header, 'ships');
  try {
    return await addShipRow(modRoot, header, row, ship);
  } catch (error) {
    throw withCause('新建舰船 CSV 和 .ship 失败', error, 'create-ship-record');
  }
}

export async function removeShipRecord(modRoot: string, id: string) {
  ensureRecordId(id, 'ships');
  try {
    return await deleteShipRow(modRoot, id);
  } catch (error) {
    throw withCause('删除舰船 CSV 和 .ship 失败', error, 'remove-ship-record');
  }
}

export async function createWeaponRecord(modRoot: string, header: string[], row: RowData, weapon: RowData) {
  ensureCsvContext(modRoot, header, 'weapons');
  try {
    return await addWeaponRow(modRoot, header, row, weapon);
  } catch (error) {
    throw withCause('新建武器 CSV 和 .wpn 失败', error, 'create-weapon-record');
  }
}

export async function removeWeaponRecord(modRoot: string, id: string) {
  ensureRecordId(id, 'weapons');
  try {
    return await deleteWeaponRow(modRoot, id);
  } catch (error) {
    throw withCause('删除武器 CSV 和 .wpn 失败', error, 'remove-weapon-record');
  }
}

function ensureCsvContext(modRoot: string, header: string[], table: TableKey) {
  if (!modRoot) {
    throw new AppError(`缺少 ${table} 的 mod 根目录`, { action: 'csv-context' });
  }
  if (header.length === 0) {
    throw new AppError(`${table} CSV 缺少表头，不能写回`, { action: 'csv-context' });
  }
}

function ensureRecordId(id: string, table: TableKey) {
  if (!id) {
    throw new AppError(`${table} 记录缺少 id，不能执行删除`, { action: 'delete-record' });
  }
}
