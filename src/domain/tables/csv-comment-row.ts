import { cell, rowDisplayId, rowSpecId } from '@/shared/lib/starsector';
import type { RowData, TableKey } from '@/shared/types';

export function isCsvCommentRow(row: RowData | null | undefined, table: TableKey): boolean {
  if (!row) return false;
  const displayId = rowDisplayId(row);
  const specId = rowSpecId(row, table);
  return startsWithHash(displayId) || startsWithHash(specId) || Object.values(row).some((value) => startsWithHash(cell(value)));
}

function startsWithHash(value: string): boolean {
  return value.trimStart().startsWith('#');
}
