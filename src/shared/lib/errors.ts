import type { ModOpeningFailure } from '@/shared/types';
import { pathBelongsToRoot } from '@/shared/lib/paths';
import { commandErrorCopy } from '@/shared/lib/error-messages';

interface CommandErrorWire {
  code: string;
  message: string;
}

/// Backend command errors arrive as structured `{ code, message }` wire
/// objects; anything else is a plain exception or a legacy string.
function wireCommandError(error: unknown): CommandErrorWire | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code !== 'string' || typeof candidate.message !== 'string') return null;
  return { code: candidate.code, message: candidate.message };
}

export function commandErrorCode(error: unknown): string | null {
  return wireCommandError(error)?.code ?? null;
}

export class AppError extends Error {
  readonly action?: string;
  readonly cause?: unknown;

  constructor(message: string, options: { action?: string; cause?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.action = options.action;
    this.cause = options.cause;
  }
}

export function withCause(message: string, cause: unknown, action?: string): AppError {
  return new AppError(message, { action, cause });
}

export function formatError(error: unknown): string {
  const wire = wireCommandError(error);
  if (wire) return commandErrorCopy(wire.code) ?? wire.message;
  if (error instanceof AppError) {
    const causeMessage = error.cause ? formatError(error.cause) : '';
    if (!causeMessage || causeMessage === error.message || error.message.includes(causeMessage)) {
      return error.message;
    }
    return `${error.message}：${causeMessage}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface FileReference {
  path: string;
  line?: number;
  column?: number;
  message: string;
}

const WINDOWS_PATH_PATTERN = /((?:\\\\\?\\)?[A-Za-z]:[\\/][^:\r\n]+?\.(?:csv|json|ship|wpn|proj|faction|variant|txt))/i;
const LINE_COLUMN_PATTERN = /\bline\s*:?\s*(\d+)\s+column\s*:?\s*(\d+)\b/i;
const LINE_PATTERN = /\bline\s*:?\s*(\d+)\b/i;

export function extractFileReferenceFromError(error: unknown): FileReference | null {
  const message = formatError(error);
  const pathMatch = message.match(WINDOWS_PATH_PATTERN);
  if (!pathMatch?.[1]) return null;
  const lineColumnMatch = message.match(LINE_COLUMN_PATTERN);
  const lineMatch = message.match(LINE_PATTERN);
  return {
    path: pathMatch[1],
    line: lineColumnMatch?.[1] ? Number(lineColumnMatch[1]) : lineMatch?.[1] ? Number(lineMatch[1]) : undefined,
    column: lineColumnMatch?.[2] ? Number(lineColumnMatch[2]) : undefined,
    message,
  };
}

export function appendFileReferenceLocation(message: string, reference: FileReference | null): string {
  if (!reference?.line) return message;
  const location = reference.column ? `第 ${reference.line} 行，第 ${reference.column} 列` : `第 ${reference.line} 行`;
  return `${message}（${location}）`;
}

export function buildModOpeningFailure(modRoot: string, error: unknown): ModOpeningFailure {
  const message = formatError(error);
  const reference = extractFileReferenceFromError(message);
  return {
    modRoot,
    message,
    file:
      reference && pathBelongsToRoot(reference.path, modRoot)
        ? { path: reference.path, line: reference.line, column: reference.column }
        : null,
  };
}
