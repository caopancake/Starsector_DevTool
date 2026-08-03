import { useDialog } from 'naive-ui/es/dialog';
import { useMessage } from 'naive-ui/es/message';
import { createAppFeedback } from '@/app/app-feedback';

export function useAppFeedback() {
  return createAppFeedback(useMessage(), useDialog());
}
