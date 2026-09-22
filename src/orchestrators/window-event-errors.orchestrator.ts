import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { errorCodeOf } from '@/shared/lib/errors';

export function recordWindowEventHandlerError(error: unknown, event: string): void {
  recordLogBestEffort({
    level: 'error',
    code: errorCodeOf(error),
    message: `window event handler failed: ${event}`,
    path: null,
    line: null,
  });
}
