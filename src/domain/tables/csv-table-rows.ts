import type { RowData } from '@/shared/types';

export function isLoadedCsvTableRow(row: RowData | null | undefined): row is RowData {
  return row !== null && row !== undefined;
}
