import { AppError } from '@/shared/lib/errors';
import type { RowData } from '@/shared/types';

export function isRowData(value: unknown): value is RowData {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function requireRowData(value: unknown, message: string): RowData {
  if (isRowData(value)) return value;
  throw new AppError(message, { action: 'read-row-data' });
}
