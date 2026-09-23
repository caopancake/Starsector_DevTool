import { recordLogBestEffort } from '@/services/app-feedback-log.service';

// Component-facing app log facade: components must consume composables, not
// services, so the best-effort log record is re-exposed through this hook.
export function useAppLog() {
  return {
    record: recordLogBestEffort,
  };
}
