import type { CsvEditHistoryEntry } from '@/shared/types/tables-edit-history.types';
import type { ModTableState } from '@/shared/types';
import { applyCsvDraftOperation } from '@/domain/tables/csv-table-draft';

export function applyCsvEditUndo(entry: CsvEditHistoryEntry, tableState: ModTableState | undefined): boolean {
  return applyCsvDraftOperation(tableState, entry.operation, 'undo');
}

export function applyCsvEditRedo(entry: CsvEditHistoryEntry, tableState: ModTableState | undefined): boolean {
  return applyCsvDraftOperation(tableState, entry.operation, 'redo');
}
