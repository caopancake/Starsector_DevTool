import { useDialog, useMessage } from 'naive-ui';
import { createAppFeedback } from '@/app/app-feedback';

export function useAppFeedback() {
  return createAppFeedback(useMessage(), useDialog());
}
