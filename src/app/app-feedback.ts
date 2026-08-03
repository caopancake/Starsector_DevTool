import { h } from 'vue';
import { NButton } from 'naive-ui/es/button';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { NSpace } from 'naive-ui/es/space';
import { NText } from 'naive-ui/es/typography';
import { extractFileReferenceFromError, formatError } from '@/shared/lib/errors';
import type { AppFeedback, ChooseOptions, ConfirmOptions } from '@/shared/types/feedback.types';
import { openFileEditorWindow } from '@/windows/file-editor.window';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { closestRootForPath } from '@/shared/lib/paths';

export function createAppFeedback(message: MessageApiInjection, dialog: DialogApiInjection): AppFeedback {
  return {
    success: (text) => message.success(text),
    info: (text) => message.info(text),
    warning: (text) => {
      recordLogBestEffort({ level: 'warning', message: text, path: null, line: null });
      message.warning(text);
    },
    error: (error, contextMessage) => showError(message, error, contextMessage),
    confirmDanger: (options) => showConfirm(dialog, 'error', options),
    confirmWarning: (options) => showConfirm(dialog, 'warning', options),
    choose: (options) => showChoose(dialog, options),
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

function showError(message: MessageApiInjection, error: unknown, contextMessage?: string) {
  const text = contextMessage ? `${contextMessage}：${formatError(error)}` : formatError(error);
  const reference = extractFileReferenceFromError(error) ?? extractFileReferenceFromError(text);
  recordLogBestEffort({
    level: 'error',
    message: text,
    path: reference?.path ?? null,
    line: reference?.line ?? null,
  });
  if (!reference) {
    message.error(text);
    return;
  }
  const modRoot = closestRootForPath(useProjectStore().manifests.keys(), reference.path);
  if (!modRoot) {
    message.error(text);
    return;
  }
  const sessionId = useProjectStore().getSessionId(modRoot);
  if (!sessionId) {
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
                    modRoot,
                    path: reference.path,
                    sessionId,
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

function showChoose(dialog: DialogApiInjection, options: ChooseOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const instance = dialog.create({
      type: 'info',
      title: options.title,
      content: options.content,
      closable: true,
      showIcon: false,
      action: () =>
        h(
          NSpace,
          { justify: 'end', size: 'small' },
          {
            default: () => [
              ...options.choices.map((choice) =>
                h(
                  NButton,
                  {
                    type: choice.type ?? 'default',
                    size: 'small',
                    onClick: () => {
                      resolved = true;
                      instance.destroy();
                      resolve(choice.value);
                    },
                  },
                  { default: () => choice.label },
                ),
              ),
              h(
                NButton,
                {
                  size: 'small',
                  onClick: () => {
                    resolved = true;
                    instance.destroy();
                    resolve(null);
                  },
                },
                { default: () => '取消' },
              ),
            ],
          },
        ),
      onClose: () => {
        if (!resolved) resolve(null);
      },
      onMaskClick: () => {
        if (!resolved) {
          resolved = true;
          instance.destroy();
          resolve(null);
        }
      },
    });
  });
}
