import { recordLogBestEffort } from '@/services/app-config.service';
import { formatError } from '@/shared/lib/errors';

export function recordWindowEventHandlerError(error: unknown, event: string): void {
  recordLogBestEffort({
    level: 'error',
    message: `处理窗口事件失败：${event}：${formatError(error)}`,
    path: null,
    line: null,
  });
}
