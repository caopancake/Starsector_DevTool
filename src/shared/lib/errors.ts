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

export function toAppError(error: unknown, fallbackMessage: string, action?: string): AppError {
  if (error instanceof AppError) return error;
  return withCause(fallbackMessage, error, action);
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
