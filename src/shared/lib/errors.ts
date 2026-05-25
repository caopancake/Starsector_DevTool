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

export function toAppError(error: unknown, defaultMessage: string, action?: string): AppError {
  if (error instanceof AppError) return error;
  return withCause(defaultMessage, error, action);
}

export function formatError(error: unknown): string {
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
  message: string;
}

const WINDOWS_PATH_PATTERN = /([A-Za-z]:[\\/][^:\r\n]+?\.(?:csv|json|ship|wpn|proj|faction|variant|txt))/i;
const LINE_PATTERN = /\bline:\s*(\d+)\b/i;

export function extractFileReferenceFromError(error: unknown): FileReference | null {
  const message = formatError(error);
  const pathMatch = message.match(WINDOWS_PATH_PATTERN);
  if (!pathMatch?.[1]) return null;
  const lineMatch = message.match(LINE_PATTERN);
  return {
    path: pathMatch[1],
    line: lineMatch?.[1] ? Number(lineMatch[1]) : undefined,
    message,
  };
}
