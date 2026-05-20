import { h } from 'vue';
import { NButton, NSpace, NText } from 'naive-ui';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { extractFileReferenceFromError, formatError } from '@/shared/lib/errors';
import type { AppFeedback, ConfirmOptions } from '@/shared/types/feedback.types';
import { openFileEditorWindow } from '@/windows/file-editor.window';
import { recordLogSilently } from '@/services/app-config.service';
import { useSettingsStore } from '@/stores/settings.store';

export function createAppFeedback(message: MessageApiInjection, dialog: DialogApiInjection): AppFeedback {
  return {
    success: (text) => message.success(text),
    info: (text) => message.info(text),
    warning: (text) => {
      recordLogSilently({ level: 'warning', message: text });
      message.warning(text);
    },
    error: (error, fallback) => showError(message, error, fallback),
    confirmDanger: (options) => showConfirm(dialog, 'error', options),
    confirmWarning: (options) => showConfirm(dialog, 'warning', options),
  };
}

function showConfirm(dialog: DialogApiInjection, type: 'error' | 'warning', options: ConfirmOptions) {
  dialog[type]({
    title: options.title,
    content: options.content,
    positiveText: options.actionText,
    negativeText: '取消',
    onPositiveClick: () => options.onConfirm(),
  });
}

function showError(message: MessageApiInjection, error: unknown, fallback?: string) {
  const text = fallback ? `${fallback}：${formatError(error)}` : formatError(error);
  const reference = extractFileReferenceFromError(error) ?? extractFileReferenceFromError(text);
  recordLogSilently({
    level: 'error',
    message: text,
    path: reference?.path,
    line: reference?.line,
  });
  if (!reference) {
    message.error(text);
    return;
  }
  message.error(
    () =>
      h(
        NSpace,
        { align: 'center', wrap: false },
        {
          default: () => [
            h(NText, { type: 'error', style: { maxWidth: '680px', overflowWrap: 'anywhere' } }, { default: () => text }),
            h(
              NButton,
              {
                size: 'tiny',
                type: 'error',
                secondary: true,
                onClick: () =>
                  void openFileEditorWindow({
                    path: reference.path,
                    line: reference.line,
                    settings: useSettingsStore().settingsSnapshot(),
                    title: '文件编辑器',
                    contextLabel: '错误',
                    contextSeverity: 'error',
                    message: reference.message,
                  }),
              },
              { default: () => '打开错误文件' },
            ),
          ],
        },
      ),
    { duration: 10000, closable: true },
  );
}
