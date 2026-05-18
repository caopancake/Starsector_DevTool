import { loadCsvTable, saveCsv, type AssociatedFileChange } from '@/shared/api/tables-api';
import { AppError, withCause } from '@/shared/lib/errors';
import type { RowData, TableKey } from '@/shared/types';

export async function saveTableRows(
  modRoot: string,
  table: TableKey,
  header: string[],
  rows: RowData[],
  associatedFiles: AssociatedFileChange[] = [],
) {
  ensureCsvContext(modRoot, header, table);
  try {
    return await saveCsv(modRoot, table, header, rows, associatedFiles);
  } catch (error) {
    throw withCause(`保存 ${table} CSV 失败`, error, 'save-table-rows');
  }
}

export async function loadTableRows(modRoot: string, table: TableKey) {
  ensureTableContext(modRoot, table);
  try {
    return await loadCsvTable(modRoot, table);
  } catch (error) {
    throw withCause(`读取 ${table} CSV 失败`, error, 'load-table-rows');
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

function ensureTableContext(modRoot: string, table: TableKey) {
  if (!modRoot) {
    throw new AppError(`缺少 ${table} 的 mod 根目录`, { action: 'csv-context' });
  }
}
