import { CSV_DEFAULT_FACTION_ID, CSV_FACTION_FILTER_ALL, type CsvFactionFilter, type TableKey } from '@/shared/types';

export interface CsvFactionFilterOption {
  label: string;
  value: string;
}

export const DEFAULT_CSV_FACTION_FILTER: CsvFactionFilter = { kind: 'all' };

export function filterFromOptionValue(value: string): CsvFactionFilter {
  const trimmed = value.trim();
  return trimmed && trimmed !== CSV_FACTION_FILTER_ALL ? { kind: 'faction', factionId: trimmed } : DEFAULT_CSV_FACTION_FILTER;
}

export function filterOptionValue(filter: CsvFactionFilter): string {
  return filter.kind === 'faction' ? filter.factionId : CSV_FACTION_FILTER_ALL;
}

export function defaultCsvFactionId(): string {
  return CSV_DEFAULT_FACTION_ID;
}

export function isFilterableTable(table: TableKey): boolean {
  return table === 'ships' || table === 'weapons';
}

export function csvFactionFilterOptions(): CsvFactionFilterOption[] {
  return [{ label: '全部势力', value: CSV_FACTION_FILTER_ALL }];
}
