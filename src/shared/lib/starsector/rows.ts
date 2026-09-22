import { str } from '@/shared/lib/starsector/value';
import type { RowData, TableKey } from '@/shared/types';

export function rowDisplayId(row: RowData): string {
  return str(row.id) || str(row.hullId) || str(row['variant id']) || str(row.name);
}

export function isDisabledCsvReference(value: string): boolean {
  return value.trim().startsWith('#');
}

function referenceableCsvId(value: string): string {
  return isDisabledCsvReference(value) ? '' : value;
}

export function rowSpecId(row: RowData, tab?: TableKey): string {
  if (tab === 'ships') return referenceableCsvId(str(row.id)) || referenceableCsvId(str(row.hullId));
  if (tab === 'weapons' || tab === 'shipSystems' || tab === 'skills') return referenceableCsvId(str(row.id));
  return referenceableCsvId(str(row.id)) || referenceableCsvId(str(row.hullId));
}
